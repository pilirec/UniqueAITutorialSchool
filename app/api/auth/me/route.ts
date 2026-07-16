import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSchool, getTeachers } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  const school = await getSchool();
  const teachers = await getTeachers();
  return NextResponse.json({
    user,
    school,
    demoAccounts: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
    })),
  });
}
