import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { Teacher } from "./types";

export async function requireUser(): Promise<
  { user: Teacher; error: null } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
