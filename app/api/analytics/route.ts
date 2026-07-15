import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { aggregateKPStats, tasksForClasses } from "@/lib/analytics";

/** 班级/全局学情看板数据 */
export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const db = getDB();
  const visible = visibleClassIds(user);
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  let scope: Set<string>;
  if (classId && classId !== "all") {
    if (!visible.has(classId)) return jsonError("无权限查看该班级", 403);
    scope = new Set([classId]);
  } else {
    scope = visible;
  }

  const tasks = tasksForClasses(scope).filter((t) => t.status === "success");
  const kpStats = aggregateKPStats(tasks);

  // 学生维度：正确率排名
  const perStudent = new Map<string, { total: number; wrong: number }>();
  for (const t of tasks) {
    if (!t.studentId) continue;
    const s = perStudent.get(t.studentId) ?? { total: 0, wrong: 0 };
    for (const r of t.results) {
      s.total += 1;
      if (!r.isCorrect) s.wrong += 1;
    }
    perStudent.set(t.studentId, s);
  }
  const studentStats = [...perStudent.entries()]
    .map(([studentId, s]) => {
      const student = db.students.find((x) => x.id === studentId);
      return {
        studentId,
        name: student?.name ?? "未知",
        className: db.classes.find((c) => c.id === student?.classId)?.name ?? "",
        avatarColor: student?.avatarColor ?? "#6366f1",
        total: s.total,
        wrong: s.wrong,
        accuracy: s.total ? Math.round(((s.total - s.wrong) / s.total) * 100) : 0,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  const totalQuestions = tasks.reduce((acc, t) => acc + t.results.length, 0);
  const totalWrong = tasks.reduce(
    (acc, t) => acc + t.results.filter((r) => !r.isCorrect).length,
    0
  );

  return NextResponse.json({
    summary: {
      taskCount: tasks.length,
      totalQuestions,
      totalWrong,
      accuracy: totalQuestions
        ? Math.round(((totalQuestions - totalWrong) / totalQuestions) * 100)
        : 0,
    },
    kpStats,
    studentStats,
  });
}
