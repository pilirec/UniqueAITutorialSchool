import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { studentCreateSchema, validateJson } from "@/lib/validation";
import { audit } from "@/lib/audit";
import type { Student } from "@/lib/types";

const AVATAR_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

function parseAge(input: number | string | undefined): number {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : 8;
}

/** 创建学生：单个 或 批量导入（Excel/CSV 粘贴解析后的数组） */
export async function POST(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;

  const body = await validateJson(req, studentCreateSchema);
  if (!body.ok) return jsonError(body.error);

  const inputs = "students" in body.data ? body.data.students : [body.data];
  if (inputs.length === 0) return jsonError("无导入数据");

  const classIds = await visibleClassIds(user);
  const created: Student[] = [];
  const errors: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const rowLabel = inputs.length > 1 ? `第 ${i + 1} 行：` : "";
      if (!input.name?.trim()) {
        errors.push(`${rowLabel}缺少姓名`);
        continue;
      }
      if (!input.classId || !classIds.has(input.classId)) {
        errors.push(`${rowLabel}${input.name} 未指定有效班级（或无权限）`);
        continue;
      }
      const s = await tx.student.create({
        data: {
          schoolId: user.schoolId,
          classId: input.classId,
          name: input.name.trim(),
          gender: input.gender === "女" ? "女" : "男",
          age: parseAge(input.age),
          parentPhone: input.parentPhone?.trim() || null,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        },
      });
      created.push({
        id: s.id,
        schoolId: s.schoolId,
        classId: s.classId,
        name: s.name,
        gender: s.gender as Student["gender"],
        age: s.age,
        parentPhone: s.parentPhone ?? undefined,
        avatarColor: s.avatarColor,
        createdAt: s.createdAt.toISOString(),
      });
    }
  });

  if (created.length > 0) {
    await audit("students_created", "students", { count: created.length }, { teacherId: user.id, schoolId: user.schoolId });
  }
  return NextResponse.json({ created, errors });
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("参数错误");

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.deletedAt) return jsonError("学生不存在", 404);

  const classIds = await visibleClassIds(user);
  if (!classIds.has(student.classId)) return jsonError("无权限", 403);

  // 软删除
  await prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit("student_deleted", `student:${id}`, {}, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({ ok: true });
}
