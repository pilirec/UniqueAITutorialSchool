import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";
import { requireUser } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";

/** 返回当前用户可见范围内的组织与基础数据（RBAC 过滤） */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const db = await getDB();
  const classIds = visibleClassIds(db, user);
  const classes = db.classes.filter((c) => classIds.has(c.id));
  const gradeIds = new Set(classes.map((c) => c.gradeId));
  const grades =
    user.role === "principal"
      ? db.grades
      : db.grades.filter((g) => gradeIds.has(g.id));
  const students = db.students.filter((s) => classIds.has(s.classId));
  return NextResponse.json({
    user,
    school: db.school,
    grades: [...grades].sort((a, b) => a.sortOrder - b.sortOrder),
    classes,
    teachers: db.teachers,
    students,
    knowledgePoints: db.knowledgePoints,
  });
}
