import { NextResponse } from "next/server";
import { getDB, saveDB, uid } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import type { Role } from "@/lib/types";

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可管理教师", 403);

  const body = (await req.json()) as {
    name?: string;
    role?: Role;
    phone?: string;
    gradeId?: string;
    classIds?: string[];
  };
  if (!body.name?.trim()) return jsonError("请填写教师姓名");
  const db = await getDB();
  const teacher = {
    id: uid("T"),
    schoolId: db.school.id,
    name: body.name.trim(),
    role: body.role ?? "teacher",
    phone: body.phone,
    gradeId: body.role === "grade_leader" ? body.gradeId : undefined,
    classIds: body.classIds ?? [],
  };
  db.teachers.push(teacher);
  await saveDB();
  return NextResponse.json(teacher);
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可管理教师", 403);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("参数错误");
  if (id === user.id) return jsonError("不能删除自己");
  const db = await getDB();
  db.teachers = db.teachers.filter((t) => t.id !== id);
  db.classes.forEach((c) => {
    if (c.headTeacherId === id) c.headTeacherId = undefined;
  });
  await saveDB();
  return NextResponse.json({ ok: true });
}
