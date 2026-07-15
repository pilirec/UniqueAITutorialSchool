import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDB } from "@/lib/store";

export async function GET() {
  const user = await getCurrentUser();
  const db = getDB();
  return NextResponse.json({
    user,
    school: db.school,
    // 登录页需要展示可选的演示账号
    demoAccounts: db.teachers.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
    })),
  });
}
