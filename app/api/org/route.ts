import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { canManageOrg } from "@/lib/auth";
import { orgCreateSchema, orgDeleteSchema, validateJson } from "@/lib/validation";
import { audit } from "@/lib/audit";

/** 组织管理：新增年级 / 班级 */
export async function POST(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (!canManageOrg(user)) return jsonError("无权限：仅校长或年级主任可管理组织架构", 403);

  const body = await validateJson(req, orgCreateSchema);
  if (!body.ok) return jsonError(body.error);

  if (body.data.type === "grade") {
    if (user.role !== "principal") return jsonError("仅校长可新增年级", 403);
    const count = await prisma.grade.count({ where: { schoolId: user.schoolId } });
    const grade = await prisma.grade.create({
      data: {
        schoolId: user.schoolId,
        name: body.data.name,
        sortOrder: count + 1,
      },
    });
    await audit("grade_created", `grade:${grade.id}`, { name: grade.name }, { teacherId: user.id, schoolId: user.schoolId });
    return NextResponse.json({ id: grade.id, schoolId: grade.schoolId, name: grade.name, sortOrder: grade.sortOrder });
  }

  // class
  if (user.role === "grade_leader" && body.data.gradeId !== user.gradeId) {
    return jsonError("年级主任只能在本年级下新增班级", 403);
  }
  const cls = await prisma.classRoom.create({
    data: {
      schoolId: user.schoolId,
      gradeId: body.data.gradeId,
      name: body.data.name,
      headTeacherId: body.data.headTeacherId || null,
    },
  });
  if (body.data.headTeacherId) {
    await prisma.teacherClassAssignment.create({
      data: { teacherId: body.data.headTeacherId, classId: cls.id },
    }).catch(() => {});
  }
  await audit("class_created", `class:${cls.id}`, { name: cls.name, gradeId: cls.gradeId }, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({
    id: cls.id,
    schoolId: cls.schoolId,
    gradeId: cls.gradeId,
    name: cls.name,
    headTeacherId: cls.headTeacherId ?? undefined,
  });
}

/** 删除年级 / 班级 */
export async function DELETE(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可删除组织节点", 403);

  const params = orgDeleteSchema.safeParse({
    type: new URL(req.url).searchParams.get("type"),
    id: new URL(req.url).searchParams.get("id"),
  });
  if (!params.success) return jsonError(params.error.issues[0]?.message || "参数错误");
  const { type, id } = params.data;

  if (type === "class") {
    const studentCount = await prisma.student.count({ where: { classId: id, deletedAt: null } });
    if (studentCount > 0) return jsonError("该班级下仍有学生，请先转移或删除学生");
    await prisma.classRoom.delete({ where: { id } });
    await audit("class_deleted", `class:${id}`, {}, { teacherId: user.id, schoolId: user.schoolId });
    return NextResponse.json({ ok: true });
  }

  // grade
  const classCount = await prisma.classRoom.count({ where: { gradeId: id } });
  if (classCount > 0) return jsonError("该年级下仍有班级，请先删除班级");
  await prisma.grade.delete({ where: { id } });
  await audit("grade_deleted", `grade:${id}`, {}, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({ ok: true });
}
