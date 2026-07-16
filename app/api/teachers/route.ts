import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { teacherCreateSchema, validateJson } from "@/lib/validation";
import { generatePassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Teacher } from "@/lib/types";

export async function POST(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可管理教师", 403);

  const body = await validateJson(req, teacherCreateSchema);
  if (!body.ok) return jsonError(body.error);

  const { name, role, phone, gradeId, classIds } = body.data;
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const teacher = await prisma.$transaction(async (tx) => {
    const t = await tx.teacher.create({
      data: {
        schoolId: user.schoolId,
        name: name.trim(),
        role,
        phone: phone?.trim() || null,
        gradeId: role === "grade_leader" ? gradeId || null : null,
        passwordHash,
      },
    });
    if (classIds?.length) {
      await tx.teacherClassAssignment.createMany({
        data: classIds.map((classId) => ({ teacherId: t.id, classId })),
        skipDuplicates: true,
      });
    }
    return tx.teacher.findUnique({
      where: { id: t.id },
      include: { classAssignments: { select: { classId: true } } },
    });
  });

  if (!teacher) return jsonError("创建教师失败", 500);

  const result: Teacher = {
    id: teacher.id,
    schoolId: teacher.schoolId,
    name: teacher.name,
    role: teacher.role as Teacher["role"],
    phone: teacher.phone ?? undefined,
    gradeId: teacher.gradeId ?? undefined,
    classIds: teacher.classAssignments.map((ca) => ca.classId),
  };

  await audit("teacher_created", `teacher:${teacher.id}`, { name, role }, { teacherId: user.id, schoolId: user.schoolId });

  // 初始密码仅在创建时返回一次，后续应通过安全渠道分发
  return NextResponse.json({ ...result, initialPassword: password });
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可管理教师", 403);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("参数错误");
  if (id === user.id) return jsonError("不能删除自己");

  await prisma.$transaction([
    prisma.teacherClassAssignment.deleteMany({ where: { teacherId: id } }),
    prisma.session.deleteMany({ where: { teacherId: id } }),
    prisma.teacher.delete({ where: { id } }),
  ]);

  await audit("teacher_deleted", `teacher:${id}`, {}, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({ ok: true });
}
