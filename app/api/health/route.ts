import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    app: "ok",
    db: "ok",
  };
  let status = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.db = "error";
    status = 503;
  }

  return NextResponse.json(
    {
      status: status === 200 ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    },
    { status }
  );
}
