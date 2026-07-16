import { NextResponse } from "next/server";
import {
  getSchool,
  getGrades,
  getClasses,
  getTeachers,
  getStudents,
  getKnowledgePoints,
} from "@/lib/db";
import { requireUser } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";

/** 返回当前用户可见范围内的组织与基础数据（RBAC 过滤） */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const [school, grades, classes, teachers, students, knowledgePoints] = await Promise.all([
    getSchool(),
    getGrades(),
    getClasses(),
    getTeachers(),
    getStudents(),
    getKnowledgePoints(),
  ]);

  const classIds = await visibleClassIds(user);
  const visibleClasses = classes.filter((c) => classIds.has(c.id));
  const visibleGradeIds = new Set(visibleClasses.map((c) => c.gradeId));
  const visibleGrades = user.role === "principal" ? grades : grades.filter((g) => visibleGradeIds.has(g.id));
  const visibleStudents = students.filter((s) => classIds.has(s.classId));

  return NextResponse.json({
    user,
    school,
    grades: visibleGrades.sort((a, b) => a.sortOrder - b.sortOrder),
    classes: visibleClasses,
    teachers,
    students: visibleStudents,
    knowledgePoints,
  });
}
