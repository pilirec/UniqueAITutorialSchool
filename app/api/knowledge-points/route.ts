import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { knowledgePointSchema, knowledgePointReviewSchema, validateJson } from "@/lib/validation";
import { getKnowledgePoints, mapKnowledgePoint } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const knowledgePoints = await getKnowledgePoints();
  return NextResponse.json({ knowledgePoints });
}

/** 教师提议新增知识点（进入待审核）；主任/校长直接入库或审核通过 */
export async function POST(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;

  const body = await validateJson(req, knowledgePointSchema);
  if (!body.ok) return jsonError(body.error);

  const existing = await prisma.knowledgePoint.findFirst({
    where: { schoolId: user.schoolId, name: body.data.name.trim(), subject: body.data.subject },
  });
  if (existing) return jsonError("该知识点已存在");

  const canApprove = user.role !== "teacher";
  const kp = await prisma.knowledgePoint.create({
    data: {
      schoolId: user.schoolId,
      subject: body.data.subject,
      name: body.data.name.trim(),
      status: canApprove ? "approved" : "pending",
      proposedBy: user.id,
    },
  });

  await audit("knowledge_point_created", `knowledgePoint:${kp.id}`, { name: kp.name, status: kp.status }, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json(mapKnowledgePoint(kp));
}

/** 审核：通过 / 驳回（删除） */
export async function PATCH(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role === "teacher") return jsonError("仅年级主任或校长可审核知识点", 403);

  const body = await validateJson(req, knowledgePointReviewSchema);
  if (!body.ok) return jsonError(body.error);

  const kp = await prisma.knowledgePoint.findUnique({ where: { id: body.data.id } });
  if (!kp) return jsonError("知识点不存在", 404);

  if (body.data.action === "approve") {
    await prisma.knowledgePoint.update({ where: { id: body.data.id }, data: { status: "approved" } });
    await audit("knowledge_point_approved", `knowledgePoint:${kp.id}`, { name: kp.name }, { teacherId: user.id, schoolId: user.schoolId });
  } else {
    await prisma.knowledgePoint.delete({ where: { id: body.data.id } });
    await audit("knowledge_point_rejected", `knowledgePoint:${kp.id}`, { name: kp.name }, { teacherId: user.id, schoolId: user.schoolId });
  }
  return NextResponse.json({ ok: true });
}
