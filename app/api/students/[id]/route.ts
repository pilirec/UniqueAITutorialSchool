import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { aggregateKPStats, tasksForStudent } from "@/lib/analytics";

/** 学生主页：档案 + Timeline + 知识点掌握 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const db = getDB();
  const student = db.students.find((s) => s.id === id);
  if (!student) return jsonError("学生不存在", 404);
  if (!visibleClassIds(user).has(student.classId)) return jsonError("无权限查看该学生", 403);

  const cls = db.classes.find((c) => c.id === student.classId);
  const grade = db.grades.find((g) => g.id === cls?.gradeId);
  const tasks = tasksForStudent(id).sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
  );
  const records = db.behaviorRecords
    .filter((r) => r.studentId === id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return NextResponse.json({
    student,
    className: cls?.name ?? "",
    gradeName: grade?.name ?? "",
    kpStats: aggregateKPStats(tasks),
    gradingTasks: tasks.map((t) => ({ ...t, imageDataUrl: t.imageDataUrl ? t.imageDataUrl : "" })),
    behaviorRecords: records,
  });
}
