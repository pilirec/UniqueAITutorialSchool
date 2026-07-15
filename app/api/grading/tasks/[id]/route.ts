import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";

/** 查询任务状态与批改结果（前端轮询用） */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const db = getDB();
  const task = db.gradingTasks.find((t) => t.id === id);
  if (!task) return jsonError("任务不存在", 404);
  const classIds = visibleClassIds(user);
  if (task.classId ? !classIds.has(task.classId) : task.teacherId !== user.id) {
    return jsonError("无权限", 403);
  }
  const { searchParams } = new URL(req.url);
  const withImage = searchParams.get("image") === "1";
  const { imageDataUrl, ...rest } = task;
  return NextResponse.json({
    task: {
      ...rest,
      hasImage: Boolean(imageDataUrl),
      ...(withImage ? { imageDataUrl } : {}),
    },
  });
}
