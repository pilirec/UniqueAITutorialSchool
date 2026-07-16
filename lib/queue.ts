import { prisma } from "./prisma";
import { logger } from "./logger";
import type { Prisma, JobStatus } from "@prisma/client";

export type JobPayload = Prisma.InputJsonValue;

export interface JobDefinition {
  id: string;
  queueName: string;
  payload: JobPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  scheduledFor: Date;
  processedAt: Date | null;
  finishedAt: Date | null;
}

export interface JobHandler<T = unknown> {
  queueName: string;
  maxAttempts?: number;
  run(payload: T, job: JobDefinition): Promise<void>;
}

const handlers = new Map<string, JobHandler<unknown>>();

export function registerJobHandler<T>(handler: JobHandler<T>): void {
  handlers.set(handler.queueName, handler as JobHandler<unknown>);
}

export async function enqueueJob(
  queueName: string,
  payload: JobPayload,
  opts: { delayMs?: number; maxAttempts?: number } = {}
): Promise<string> {
  const scheduledFor = new Date(Date.now() + (opts.delayMs ?? 0));
  const job = await prisma.jobQueue.create({
    data: {
      queueName,
      payload,
      scheduledFor,
      maxAttempts: opts.maxAttempts ?? 3,
    },
  });
  return job.id;
}

/**
 * 从数据库拿出一个待执行任务并标记为 processing。
 * 多实例环境下建议配合唯一索引 + 排他锁或 Redis 使用。
 */
export async function acquireJob(queueName?: string): Promise<JobDefinition | null> {
  const job = await prisma.$transaction(async (tx) => {
    const found = await tx.jobQueue.findFirst({
      where: {
        status: { in: ["pending", "failed"] },
        scheduledFor: { lte: new Date() },
        attempts: { lt: tx.jobQueue.fields.maxAttempts },
        ...(queueName ? { queueName } : {}),
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    });
    if (!found) return null;
    return tx.jobQueue.update({
      where: { id: found.id },
      data: { status: "processing", processedAt: new Date() },
    });
  });

  if (!job) return null;
  return job as JobDefinition;
}

export async function completeJob(jobId: string, error?: string): Promise<void> {
  const status: JobStatus = error ? "failed" : "success";
  await prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status,
      error: error ? error.slice(0, 2000) : null,
      finishedAt: new Date(),
    },
  });
}

export async function rescheduleJob(jobId: string, delayMs: number): Promise<void> {
  await prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: "pending",
      scheduledFor: new Date(Date.now() + delayMs),
    },
  });
}

/** 执行单个任务：成功则完成，失败则指数退让重试。 */
export async function runOneJob(queueName?: string): Promise<boolean> {
  const job = await acquireJob(queueName);
  if (!job) return false;
  const handler = handlers.get(job.queueName);
  if (!handler) {
    await completeJob(job.id, "未注册的任务处理器");
    return true;
  }
  try {
    await handler.run(job.payload, job);
    await completeJob(job.id);
    logger.info({ jobId: job.id, queueName: job.queueName }, "job completed");
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const attempts = job.attempts + 1;
    if (attempts >= (handler.maxAttempts ?? job.maxAttempts)) {
      await completeJob(job.id, err);
      logger.warn({ jobId: job.id, queueName: job.queueName, error: err, attempts }, "job failed permanently");
    } else {
      // 指数退让重试：1s / 2s / 4s / ...
      const backoffMs = Math.min(2 ** attempts * 1000, 60_000);
      await rescheduleJob(job.id, backoffMs);
      logger.warn({ jobId: job.id, queueName: job.queueName, error: err, attempts, backoffMs }, "job retry scheduled");
    }
  }
  return true;
}

/** 扫描并执行所有到期任务（适合被 Vercel cron 或 after() 调用）。 */
export async function runPendingJobs(queueName?: string): Promise<number> {
  let ran = 0;
  while (await runOneJob(queueName)) {
    ran += 1;
    // 防止单次调用无限执行
    if (ran >= 50) break;
  }
  return ran;
}

/** 将超时未完成的 processing 任务重置为 pending（建议每 5 分钟运行一次）。 */
export async function recoverStalledJobs(timeoutMs = 10 * 60 * 1000): Promise<number> {
  const deadline = new Date(Date.now() - timeoutMs);
  const result = await prisma.jobQueue.updateMany({
    where: {
      status: "processing",
      processedAt: { lt: deadline },
    },
    data: { status: "pending" },
  });
  return result.count;
}
