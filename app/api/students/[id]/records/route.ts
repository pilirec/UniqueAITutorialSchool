import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { behaviorRecordSchema, validateJson } from "@/lib/validation";
import { getAISettings, mapBehaviorRecord } from "@/lib/db";
import { runBehaviorAnalysis } from "@/lib/ai/behavior";
import { audit } from "@/lib/audit";

/** 新增学生行为记录：AI 抽取标签并生成结构化摘要 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id, deletedAt: null } });
  if (!student) return jsonError("学生不存在", 404);
  if (!(await visibleClassIds(user)).has(student.classId)) return jsonError("无权限", 403);

  const body = await validateJson(req, behaviorRecordSchema);
  if (!body.ok) return jsonError(body.error);

  const settings = await getAISettings();
  let analysis;
  try {
    analysis = await runBehaviorAnalysis(settings, body.data.text);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "AI 分析失败", 502);
  }

  const type = ["behavior", "homework", "note"].includes(body.data.type ?? "")
    ? (body.data.type as "behavior" | "homework" | "note")
    : "behavior";

  const record = await prisma.behaviorRecord.create({
    data: {
      schoolId: user.schoolId,
      studentId: id,
      teacherId: user.id,
      type,
      rawText: body.data.text,
      tags: analysis.tags as never,
      summary: analysis.summary,
      provider: settings.provider,
    },
  });

  await audit("behavior_record_created", `student:${id}`, { type }, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json(mapBehaviorRecord(record));
}
