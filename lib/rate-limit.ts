import { prisma } from "./prisma";

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_LOGIN_RULE: RateLimitRule = {
  windowMs: 15 * 60 * 1000, // 15 分钟
  maxRequests: 10, // 每个 key 最多 10 次
};

function windowStart(now: Date, windowMs: number): Date {
  const t = now.getTime();
  return new Date(Math.floor(t / windowMs) * windowMs);
}

/**
 * 基于 Prisma 的简易速率限制。
 * 适用于无 Redis 的部署；高并发场景建议替换为 Redis + sliding window。
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule = DEFAULT_LOGIN_RULE
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const now = new Date();
  const start = windowStart(now, rule.windowMs);

  // 清理过期窗口
  await prisma.rateLimit.deleteMany({
    where: {
      key,
      windowStart: { lt: start },
    },
  });

  const record = await prisma.rateLimit.findUnique({ where: { key } });

  if (!record || new Date(record.windowStart).getTime() < start.getTime()) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, windowStart: start, count: 1 },
      update: { windowStart: start, count: 1 },
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (record.count >= rule.maxRequests) {
    const retryAfterMs = rule.windowMs - (now.getTime() - start.getTime());
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimitKey(identifier: string, action: string): string {
  return `${action}:${identifier}`;
}
