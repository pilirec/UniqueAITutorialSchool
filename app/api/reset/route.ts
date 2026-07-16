import { NextResponse } from "next/server";
import { requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { seedPrisma } from "@/lib/seed-prisma";
import { audit } from "@/lib/audit";

/** 重置为演示种子数据（仅校长） */
export async function POST(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可重置演示数据", 403);

  await seedPrisma();
  await audit("db_reset", "system", {}, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({ ok: true });
}
