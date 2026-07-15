import { NextResponse } from "next/server";
import { getDB, saveDB, uid } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import type { Student } from "@/lib/types";

const AVATAR_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface StudentInput {
  name?: string;
  gender?: string;
  age?: number | string;
  parentPhone?: string;
  classId?: string;
}

/** 创建学生：单个 或 批量导入（Excel/CSV 粘贴解析后的数组） */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const body = (await req.json()) as { students?: StudentInput[] } & StudentInput;
  const inputs: StudentInput[] = body.students ?? [body];
  if (inputs.length === 0) return jsonError("无导入数据");

  const db = await getDB();
  const classIds = visibleClassIds(db, user);
  const created: Student[] = [];
  const errors: string[] = [];

  inputs.forEach((input, i) => {
    const rowLabel = inputs.length > 1 ? `第 ${i + 1} 行：` : "";
    if (!input.name?.trim()) {
      errors.push(`${rowLabel}缺少姓名`);
      return;
    }
    if (!input.classId || !classIds.has(input.classId)) {
      errors.push(`${rowLabel}${input.name} 未指定有效班级（或无权限）`);
      return;
    }
    const age = Number(input.age);
    created.push({
      id: uid("S"),
      schoolId: db.school.id,
      classId: input.classId,
      name: input.name.trim(),
      gender: input.gender === "女" ? "女" : "男",
      age: Number.isFinite(age) && age > 0 ? age : 8,
      parentPhone: input.parentPhone?.trim() || undefined,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      createdAt: new Date().toISOString(),
    });
  });

  db.students.push(...created);
  await saveDB();
  return NextResponse.json({ created, errors });
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const db = await getDB();
  const student = db.students.find((s) => s.id === id);
  if (!student) return jsonError("学生不存在", 404);
  if (!visibleClassIds(db, user).has(student.classId)) return jsonError("无权限", 403);
  db.students = db.students.filter((s) => s.id !== id);
  await saveDB();
  return NextResponse.json({ ok: true });
}
