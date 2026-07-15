import { NextResponse } from "next/server";
import { getDB, saveDB, uid } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import type { Subject } from "@/lib/types";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const db = await getDB();
  return NextResponse.json({ knowledgePoints: db.knowledgePoints });
}

/** 教师提议新增知识点（进入待审核）；主任/校长直接入库或审核通过 */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const body = (await req.json()) as { name?: string; subject?: Subject };
  if (!body.name?.trim()) return jsonError("请填写知识点名称");
  const subject: Subject = body.subject === "chinese" ? "chinese" : "math";
  const db = await getDB();
  if (db.knowledgePoints.some((k) => k.name === body.name!.trim() && k.subject === subject)) {
    return jsonError("该知识点已存在");
  }
  const canApprove = user.role !== "teacher";
  const kp = {
    id: uid(`KP_${subject.toUpperCase()}`),
    schoolId: db.school.id,
    subject,
    name: body.name.trim(),
    status: (canApprove ? "approved" : "pending") as "approved" | "pending",
    proposedBy: user.id,
  };
  db.knowledgePoints.push(kp);
  await saveDB();
  return NextResponse.json(kp);
}

/** 审核：通过 / 驳回（删除） */
export async function PATCH(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role === "teacher") return jsonError("仅年级主任或校长可审核知识点", 403);
  const body = (await req.json()) as { id?: string; action?: "approve" | "reject" };
  const db = await getDB();
  const kp = db.knowledgePoints.find((k) => k.id === body.id);
  if (!kp) return jsonError("知识点不存在", 404);
  if (body.action === "approve") {
    kp.status = "approved";
  } else if (body.action === "reject") {
    db.knowledgePoints = db.knowledgePoints.filter((k) => k.id !== body.id);
  } else {
    return jsonError("未知操作");
  }
  await saveDB();
  return NextResponse.json({ ok: true });
}
