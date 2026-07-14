import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { getDB, saveDB, uid } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { runGrading } from "@/lib/ai/grading";
import type { GradingTask, Subject } from "@/lib/types";

// Vercel 函数最长执行时间（真实 VLM 批改可能需要数十秒；Hobby 计划上限见 README）
export const maxDuration = 60;

function taskListItem(t: ReturnType<typeof getDB>["gradingTasks"][number]) {
  const { imageDataUrl, ...rest } = t;
  return { ...rest, hasImage: Boolean(imageDataUrl) };
}

/** 任务列表（当前用户可见范围） */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const db = getDB();
  const classIds = visibleClassIds(user);
  const tasks = db.gradingTasks
    .filter((t) => (t.classId ? classIds.has(t.classId) : t.teacherId === user.id))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map(taskListItem);
  return NextResponse.json({ tasks });
}

/**
 * 创建批改任务：教师拍照上传 → 立即返回 task_id → 后台异步调用 VLM → 前端轮询。
 * （原型用 after() 模拟 Celery 异步队列，生产版见 PRD 5.2/6）
 */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const body = (await req.json()) as {
    imageDataUrl?: string;
    imageName?: string;
    studentId?: string;
    subject?: Subject;
  };
  if (!body.imageDataUrl?.startsWith("data:image/")) {
    return jsonError("请上传作业照片");
  }
  const subject: Subject = body.subject === "chinese" ? "chinese" : "math";
  const db = getDB();

  let classId: string | undefined;
  if (body.studentId) {
    const student = db.students.find((s) => s.id === body.studentId);
    if (!student) return jsonError("学生不存在", 404);
    if (!visibleClassIds(user).has(student.classId)) return jsonError("无权限", 403);
    classId = student.classId;
  }

  // 幂等键：teacher_id + image_md5（PRD 第 6 节）
  const imageMd5 = createHash("md5").update(body.imageDataUrl).digest("hex");
  const existing = db.gradingTasks.find(
    (t) =>
      t.teacherId === user.id &&
      t.imageMd5 === imageMd5 &&
      t.studentId === body.studentId &&
      t.status !== "failed"
  );
  if (existing) {
    return NextResponse.json({ task: taskListItem(existing), deduplicated: true });
  }

  const settings = db.aiSettings;
  const task: GradingTask = {
    id: uid("TASK"),
    schoolId: db.school.id,
    teacherId: user.id,
    studentId: body.studentId,
    classId,
    subject,
    imageMd5,
    imageDataUrl: body.imageDataUrl,
    imageName: body.imageName,
    status: "processing" as const,
    provider: settings.provider,
    model: settings.provider === "mock" ? "demo-vision" : settings.model,
    results: [],
    createdAt: new Date().toISOString(),
  };
  db.gradingTasks.push(task);
  saveDB();

  // 异步执行 AI 批改（响应返回后继续运行；本地与 Vercel 均支持）
  after(async () => {
    try {
      const { results, overallComment } = await runGrading({
        settings,
        imageDataUrl: task.imageDataUrl,
        imageMd5,
        subject,
        knowledgePoints: db.knowledgePoints,
      });
      task.status = "success";
      task.results = results;
      task.overallComment = overallComment;
    } catch (e) {
      task.status = "failed";
      task.error = e instanceof Error ? e.message : "批改失败";
    }
    task.finishedAt = new Date().toISOString();
    saveDB();
  });

  return NextResponse.json({ task: taskListItem(task) });
}
