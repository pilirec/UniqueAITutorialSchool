import { NextResponse } from "next/server";
import { resetDB } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";

/** 重置为演示种子数据（仅校长） */
export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可重置演示数据", 403);
  resetDB();
  return NextResponse.json({ ok: true });
}
