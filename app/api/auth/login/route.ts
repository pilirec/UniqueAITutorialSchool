import { NextResponse } from "next/server";
import { verifyPassword, setSession } from "@/lib/auth";
import { jsonError, getClientIp } from "@/lib/api-helpers";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { loginSchema, validateJson } from "@/lib/validation";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const body = await validateJson(req, loginSchema);
  if (!body.ok) return jsonError(body.error);

  const { teacherId, password } = body.data;
  const rateKey = rateLimitKey(ip || teacherId, "login");
  const limit = await checkRateLimit(rateKey);
  if (!limit.allowed) {
    logger.warn({ teacherId, ip }, "login rate limited");
    return jsonError("登录尝试过于频繁，请稍后重试", 429);
  }

  const teacher = await verifyPassword(teacherId, password);
  if (!teacher) {
    await audit("login_failed", "auth", { teacherId, ip }, { ip });
    // 故意模糊错误信息，防止暴力枚举
    return jsonError("账号或密码错误", 401);
  }

  await setSession(teacher);
  await audit("login_success", "auth", { teacherId: teacher.id, role: teacher.role }, { ip, teacherId: teacher.id, schoolId: teacher.schoolId });
  logger.info({ teacherId: teacher.id, ip }, "login success");

  return NextResponse.json({
    user: {
      id: teacher.id,
      name: teacher.name,
      role: teacher.role,
    },
  });
}
