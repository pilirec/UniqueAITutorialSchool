import { readImage } from "@/lib/storage";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds, type Teacher } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 提供本地上传目录（.data/uploads）或私有 S3 桶中图片的访问 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  // 文件访问 RBAC：检查该用户是否有权查看这张图片
  const fileUrl = `/api/files/${encodeURIComponent(decodedKey)}`;
  const canAccess = await canAccessFile(user, decodedKey, fileUrl);
  if (!canAccess) {
    return jsonError("无权限访问该文件", 403);
  }

  const file = await readImage(decodedKey);
  if (!file) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

async function canAccessFile(user: Teacher, key: string, fileUrl: string): Promise<boolean> {
  if (!user) return false;

  // Logo 允许所有登录用户访问（校区公开形象）
  if (key.startsWith("branding/")) {
    const school = await prisma.school.findFirst({ where: { logoSrc: fileUrl } });
    return school?.id === user.schoolId;
  }

  // 批改任务图片：通过 task 关联的 classId 做 RBAC
  if (key.startsWith("tasks/")) {
    const tasks = await prisma.gradingTask.findMany({
      where: { imageSrc: fileUrl },
      select: { classId: true, teacherId: true },
    });
    if (tasks.length === 0) return false;
    const classIds = await visibleClassIds(user);
    return tasks.some(
      (task: { classId: string | null; teacherId: string }) =>
        task.classId ? classIds.has(task.classId) : task.teacherId === user.id
    );
  }

  return false;
}
