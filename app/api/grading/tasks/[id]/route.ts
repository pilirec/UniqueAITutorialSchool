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
  const db = await getDB();
  const task = db.gradingTasks.find((t) => t.id === id);
  if (!task) return jsonError("任务不存在", 404);
  const classIds = visibleClassIds(db, user);
  if (task.classId ? !classIds.has(task.classId) : task.teacherId !== user.id) {
    return jsonError("无权限", 403);
  }
  const { searchParams } = new URL(req.url);
  const withImage = searchParams.get("image") === "1";
  const { imageSrc, ...rest } = task;
  return NextResponse.json({
    task: {
      ...rest,
      hasImage: Boolean(imageSrc),
      // 详情页请求 image=1 时返回完整图片地址（含内联 base64）；否则仅返回非内联 URL
      imageSrc: withImage || !imageSrc.startsWith("data:") ? imageSrc : "",
    },
  });
}
