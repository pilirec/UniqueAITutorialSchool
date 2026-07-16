import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { logger } from "./logger";
import type { Teacher as PrismaTeacher } from "@prisma/client";

const SESSION_COOKIE = "tutoring_session";
const CSRF_COOKIE = "tutoring_csrf";

export type Role = "principal" | "grade_leader" | "teacher";

function nullToUndefined<T>(v: T | null): T | undefined {
  return v === null ? undefined : v;
}

export interface Teacher {
  id: string;
  schoolId: string;
  name: string;
  role: Role;
  phone?: string;
  email?: string;
  gradeId?: string;
  classIds: string[];
}

function toTeacher(t: PrismaTeacher & { classAssignments?: { classId: string }[] }): Teacher {
  return {
    id: t.id,
    schoolId: t.schoolId,
    name: t.name,
    role: t.role as Role,
    phone: nullToUndefined(t.phone),
    email: nullToUndefined(t.email),
    gradeId: nullToUndefined(t.gradeId),
    classIds: t.classAssignments?.map((ca) => ca.classId) ?? [],
  };
}

async function getTeacherWithClasses(id: string): Promise<PrismaTeacher | null> {
  return prisma.teacher.findUnique({
    where: { id },
    include: { classAssignments: { select: { classId: true } } },
  });
}

function isSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIE === "true";
}

function cookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "strict",
    path: "/",
    expires: new Date(Date.now() + 60 * 60 * 24 * 7 * 1000), // 7 天
  };
}

export async function getCurrentUser(): Promise<Teacher | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      teacher: {
        include: { classAssignments: { select: { classId: true } } },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await clearSessionToken(token).catch(() => {});
    }
    return null;
  }

  return toTeacher(session.teacher);
}

export async function verifyPassword(
  teacherId: string,
  password: string
): Promise<Teacher | null> {
  const teacher = await getTeacherWithClasses(teacherId);
  if (!teacher || !teacher.passwordHash) return null;
  const ok = await bcrypt.compare(password, teacher.passwordHash);
  if (!ok) return null;
  return toTeacher(teacher);
}

export async function setPassword(teacherId: string, plainPassword: string): Promise<void> {
  const hash = await bcrypt.hash(plainPassword, 12);
  await prisma.teacher.update({ where: { id: teacherId }, data: { passwordHash: hash } });
}

export async function createSession(teacher: Teacher): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000);
  await prisma.session.create({
    data: {
      token,
      teacherId: teacher.id,
      schoolId: teacher.schoolId,
      expiresAt,
    },
  });
  return token;
}

export async function setSession(teacher: Teacher): Promise<void> {
  const token = await createSession(teacher);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions());
  // 同时下发 CSRF token（Double Submit Cookie 模式）
  const csrfToken = crypto.randomBytes(32).toString("hex");
  jar.set(CSRF_COOKIE, csrfToken, {
    ...cookieOptions(),
    httpOnly: false, // 前端需要读取并放入 header
  });
}

async function clearSessionToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await clearSessionToken(token).catch((e) => logger.warn({ err: e }, "clear session failed"));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

/** 获取当前请求的 CSRF token（从 cookie 中读取）。 */
export async function getCsrfToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(CSRF_COOKIE)?.value;
}

/**
 * 验证 CSRF token。
 * 对于非 GET/HEAD 请求，必须检查 header 中的 X-CSRF-Token 与 cookie 中的 token 是否一致。
 */
export async function verifyCsrfToken(req: Request): Promise<boolean> {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const expected = await getCsrfToken();
  if (!expected) return false;
  const actual = req.headers.get("x-csrf-token");
  if (!actual) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

/** 根据角色返回可见班级 ID 集合（RBAC 数据可见性）。 */
export async function visibleClassIds(user: Teacher): Promise<Set<string>> {
  if (user.role === "principal") {
    const classes = await prisma.classRoom.findMany({ select: { id: true } });
    return new Set(classes.map((c) => c.id));
  }
  if (user.role === "grade_leader" && user.gradeId) {
    const classes = await prisma.classRoom.findMany({
      where: { gradeId: user.gradeId },
      select: { id: true },
    });
    return new Set(classes.map((c) => c.id));
  }
  return new Set(user.classIds);
}

export async function visibleStudentIds(user: Teacher): Promise<Set<string>> {
  const classIds = await visibleClassIds(user);
  if (classIds.size === 0) return new Set();
  const students = await prisma.student.findMany({
    where: { classId: { in: [...classIds] }, deletedAt: null },
    select: { id: true },
  });
  return new Set(students.map((s) => s.id));
}

export function canManageOrg(user: Teacher): boolean {
  return user.role === "principal" || user.role === "grade_leader";
}

/** 用于密码重置或第一次登录后强制修改密码。 */
export function generatePassword(): string {
  return crypto.randomBytes(8).toString("hex");
}
