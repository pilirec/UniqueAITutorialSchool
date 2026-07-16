import { prisma } from "./prisma";
import { logger } from "./logger";
import type { Prisma } from "@prisma/client";

export interface AuditContext {
  schoolId?: string;
  teacherId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * 写入审计日志。将重要数据访问、修改、登录、敏感操作落盘，
 * 便于后续排查与合规审查（个保法 / GDPR）。
 */
export async function audit(
  action: string,
  resource: string,
  detail: Record<string, unknown>,
  ctx: AuditContext = {}
): Promise<void> {
  const { schoolId, teacherId, ip, userAgent } = ctx;
  const payload: Prisma.AuditLogUncheckedCreateInput = {
    action,
    resource,
    detail: detail as Prisma.InputJsonValue,
    schoolId,
    teacherId,
    ip: ip?.slice(0, 45),
    userAgent: userAgent?.slice(0, 512),
  };
  try {
    await prisma.auditLog.create({ data: payload });
  } catch (e) {
    // 审计日志不应影响主业务，落盘后继续返回
    logger.warn({ err: e, action, resource }, "audit log failed");
  }
}
