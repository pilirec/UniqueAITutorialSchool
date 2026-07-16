import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { putImage } from "@/lib/storage";
import { enqueueJob } from "@/lib/queue";
import { dispatchGradingJobs } from "@/lib/jobs";
import { getAISettings, mapGradingTask } from "@/lib/db";
import { gradingTaskCreateSchema, validateJson, validateImageDataUrl } from "@/lib/validation";
import { audit } from "@/lib/audit";
import type { GradingTask } from "@/lib/types";

// Vercel 函数最长执行时间（任务创建本身很快，后台批改由队列执行）
export const maxDuration = 30;

function taskListItem(t: GradingTask) {
  const { imageSrc, ...rest } = t;
  return {
    ...rest,
    hasImage: Boolean(imageSrc),
    // 内联 base64 图片较大，列表不返回；对象存储 / 本地文件 URL 很小，直接返回
    imageSrc: imageSrc.startsWith("data:") ? "" : imageSrc,
  };
}

/** 任务列表（当前用户可见范围） */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const classIds = await visibleClassIds(user);
  const tasks = await prisma.gradingTask.findMany({
    where: {
      OR: [{ classId: { in: [...classIds] } }, { teacherId: user.id }],
    },
    include: { results: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tasks: tasks.map(mapGradingTask).map(taskListItem) });
}

/**
 * 创建批改任务：教师拍照上传 → 图片入对象存储 → 立即返回 task_id →
 * 后台异步调用 VLM → 前端轮询。
 */
export async function POST(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;

  const body = await validateJson(req, gradingTaskCreateSchema);
  if (!body.ok) return jsonError(body.error);

  const { imageDataUrl, imageName, studentId, subject } = body.data;
  const img = validateImageDataUrl(imageDataUrl);
  if (!img.ok) return jsonError(img.error || "请上传有效的作业照片");

  let classId: string | undefined;
  if (studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) return jsonError("学生不存在", 404);
    if (!(await visibleClassIds(user)).has(student.classId)) return jsonError("无权限", 403);
    classId = student.classId;
  }

  // 幂等键：teacher_id + image_md5（PRD 第 6 节）
  const imageMd5 = createHash("md5").update(imageDataUrl).digest("hex");
  const existing = await prisma.gradingTask.findFirst({
    where: {
      teacherId: user.id,
      imageMd5,
      studentId: studentId || null,
      status: { not: "failed" },
    },
    include: { results: true },
  });
  if (existing) {
    return NextResponse.json({ task: taskListItem(mapGradingTask(existing)), deduplicated: true });
  }

  let imageSrc: string;
  try {
    imageSrc = await putImage(`tasks/${imageMd5}`, imageDataUrl);
  } catch (e) {
    return jsonError(e instanceof Error ? `图片存储失败：${e.message}` : "图片存储失败", 502);
  }

  const settings = await getAISettings();
  const task = await prisma.gradingTask.create({
    data: {
      schoolId: user.schoolId,
      teacherId: user.id,
      studentId: studentId || null,
      classId: classId || null,
      subject,
      imageMd5,
      imageSrc,
      imageName: imageName || null,
      status: "processing",
      provider: settings.provider,
      model: settings.provider === "mock" ? "demo-vision" : settings.model,
    },
  });

  // 加入异步批改队列
  await enqueueJob("grading", {
    taskId: task.id,
    imageDataUrl,
    imageMd5,
    subject,
  });

  // 响应返回后再执行待处理任务（Vercel after 可在响应后运行一段时间）
  after(async () => {
    try {
      await dispatchGradingJobs();
    } catch (e) {
      // 已在队列层记录错误，这里仅记录日志
      console.error("[grading] dispatch failed", e);
    }
  });

  await audit("grading_task_created", `gradingTask:${task.id}`, { subject, studentId }, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({ task: taskListItem(mapGradingTask({ ...task, results: [] })) });
}
