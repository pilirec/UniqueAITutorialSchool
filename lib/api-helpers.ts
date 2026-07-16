import { NextResponse } from "next/server";
import { getCurrentUser, verifyCsrfToken, type Teacher } from "./auth";

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

export async function requireUserWithCsrf(
  req: Request
): Promise<{ user: Teacher; error: null } | { user: null; error: NextResponse }> {
  const auth = await requireUser();
  if (auth.error) return auth;
  const ok = await verifyCsrfToken(req);
  if (!ok) {
    return {
      user: null,
      error: NextResponse.json({ error: "CSRF token 无效" }, { status: 403 }),
    };
  }
  return auth;
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function getClientIp(req: Request): string | undefined {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return headers.get("x-real-ip") ?? undefined;
}

export function getUserAgent(req: Request): string | undefined {
  return req.headers.get("user-agent") ?? undefined;
}
