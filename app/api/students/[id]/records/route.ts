import { NextResponse } from "next/server";
import { getDB, saveDB, uid } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { visibleClassIds } from "@/lib/auth";
import { runBehaviorAnalysis } from "@/lib/ai/behavior";

/** 新增学生行为记录：AI 抽取标签并生成结构化摘要 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const db = getDB();
  const student = db.students.find((s) => s.id === id);
  if (!student) return jsonError("学生不存在", 404);
  if (!visibleClassIds(user).has(student.classId)) return jsonError("无权限", 403);

  const body = (await req.json()) as { text?: string; type?: string };
  const text = body.text?.trim();
  if (!text) return jsonError("请输入观察记录内容");

  let analysis;
  try {
    analysis = await runBehaviorAnalysis(db.aiSettings, text);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "AI 分析失败", 502);
  }

  const record = {
    id: uid("BR"),
    schoolId: db.school.id,
    studentId: id,
    teacherId: user.id,
    type: (["behavior", "homework", "note"].includes(body.type ?? "")
      ? body.type
      : "behavior") as "behavior" | "homework" | "note",
    rawText: text,
    tags: analysis.tags,
    summary: analysis.summary,
    provider: db.aiSettings.provider,
    createdAt: new Date().toISOString(),
  };
  db.behaviorRecords.push(record);
  saveDB();
  return NextResponse.json(record);
}
