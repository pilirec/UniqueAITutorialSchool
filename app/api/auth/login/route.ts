import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";
import { setSession } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const { teacherId } = (await req.json()) as { teacherId?: string };
  const db = await getDB();
  const teacher = db.teachers.find((t) => t.id === teacherId);
  if (!teacher) return jsonError("账号不存在", 404);
  await setSession(teacher.id);
  return NextResponse.json({ user: teacher });
}
