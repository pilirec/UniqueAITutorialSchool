import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { aggregateKPStats, tasksForStudent } from "@/lib/analytics";
import { mapBehaviorRecord, mapStudent } from "@/lib/db";

/** 学生主页：档案 + Timeline + 知识点掌握 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id, deletedAt: null },
    include: { class: { include: { grade: true } } },
  });
  if (!student) return jsonError("学生不存在", 404);
  if (!(await visibleClassIds(user)).has(student.classId)) return jsonError("无权限查看该学生", 403);

  const tasks = (await tasksForStudent(id)).sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
  );
  const records = await prisma.behaviorRecord.findMany({
    where: { studentId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    student: mapStudent(student),
    className: student.class.name,
    gradeName: student.class.grade.name,
    kpStats: aggregateKPStats(tasks),
    gradingTasks: tasks.map((t) => ({
      ...t,
      // 内联 base64 图片较大，学生主页 Timeline 不需要展示原图
      imageSrc: t.imageSrc.startsWith("data:") ? "" : t.imageSrc,
    })),
    behaviorRecords: records.map(mapBehaviorRecord),
  });
}
