import { NextResponse } from "next/server";
import { getDB, saveDB, uid } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { canManageOrg } from "@/lib/auth";

/** 组织管理：新增年级 / 班级 */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!canManageOrg(user)) return jsonError("无权限：仅校长或年级主任可管理组织架构", 403);

  const body = (await req.json()) as {
    type: "grade" | "class";
    name?: string;
    gradeId?: string;
    headTeacherId?: string;
  };
  const db = await getDB();

  if (body.type === "grade") {
    if (user.role !== "principal") return jsonError("仅校长可新增年级", 403);
    if (!body.name?.trim()) return jsonError("请填写年级名称");
    const grade = {
      id: uid("G"),
      schoolId: db.school.id,
      name: body.name.trim(),
      sortOrder: db.grades.length + 1,
    };
    db.grades.push(grade);
    await saveDB();
    return NextResponse.json(grade);
  }

  if (body.type === "class") {
    if (!body.name?.trim() || !body.gradeId) return jsonError("请填写班级名称并选择年级");
    if (user.role === "grade_leader" && body.gradeId !== user.gradeId) {
      return jsonError("年级主任只能在本年级下新增班级", 403);
    }
    const cls = {
      id: uid("C"),
      schoolId: db.school.id,
      gradeId: body.gradeId,
      name: body.name.trim(),
      headTeacherId: body.headTeacherId,
    };
    db.classes.push(cls);
    if (body.headTeacherId) {
      const t = db.teachers.find((x) => x.id === body.headTeacherId);
      if (t && !t.classIds.includes(cls.id)) t.classIds.push(cls.id);
    }
    await saveDB();
    return NextResponse.json(cls);
  }

  return jsonError("未知类型");
}

/** 删除年级 / 班级 */
export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可删除组织节点", 403);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const db = await getDB();

  if (type === "class" && id) {
    if (db.students.some((s) => s.classId === id)) {
      return jsonError("该班级下仍有学生，请先转移或删除学生");
    }
    db.classes = db.classes.filter((c) => c.id !== id);
    db.teachers.forEach((t) => {
      t.classIds = t.classIds.filter((c) => c !== id);
    });
    await saveDB();
    return NextResponse.json({ ok: true });
  }
  if (type === "grade" && id) {
    if (db.classes.some((c) => c.gradeId === id)) {
      return jsonError("该年级下仍有班级，请先删除班级");
    }
    db.grades = db.grades.filter((g) => g.id !== id);
    await saveDB();
    return NextResponse.json({ ok: true });
  }
  return jsonError("参数错误");
}
