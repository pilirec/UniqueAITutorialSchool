import { cookies } from "next/headers";
import { getDB } from "./store";
import type { DB, Teacher } from "./types";

const SESSION_COOKIE = "tutoring_session";

export async function getCurrentUser(): Promise<Teacher | null> {
  const jar = await cookies();
  const teacherId = jar.get(SESSION_COOKIE)?.value;
  if (!teacherId) return null;
  const db = await getDB();
  return db.teachers.find((t) => t.id === teacherId) ?? null;
}

export async function setSession(teacherId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, teacherId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** 根据角色返回可见班级 ID 集合（RBAC 数据可见性，见 PRD 2.1） */
export function visibleClassIds(db: DB, user: Teacher): Set<string> {
  if (user.role === "principal") {
    return new Set(db.classes.map((c) => c.id));
  }
  if (user.role === "grade_leader") {
    return new Set(db.classes.filter((c) => c.gradeId === user.gradeId).map((c) => c.id));
  }
  return new Set(user.classIds);
}

export function visibleStudentIds(db: DB, user: Teacher): Set<string> {
  const classIds = visibleClassIds(db, user);
  return new Set(db.students.filter((s) => classIds.has(s.classId)).map((s) => s.id));
}

export function canManageOrg(user: Teacher): boolean {
  return user.role === "principal" || user.role === "grade_leader";
}
