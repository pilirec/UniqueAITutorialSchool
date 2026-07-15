"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, formatTime, SUBJECT_LABELS } from "@/lib/client-api";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Avatar,
  EmptyState,
  Spinner,
  inputCls,
} from "@/components/ui";
import { MasteryRadar } from "@/components/charts";
import type { Student, GradingTask, BehaviorRecord } from "@/lib/types";
import type { KPStat } from "@/lib/analytics";

interface ProfileResp {
  student: Student;
  className: string;
  gradeName: string;
  kpStats: KPStat[];
  gradingTasks: GradingTask[];
  behaviorRecords: BehaviorRecord[];
}

type TimelineItem =
  | { kind: "task"; time: string; task: GradingTask }
  | { kind: "record"; time: string; record: BehaviorRecord };

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [recordType, setRecordType] = useState("behavior");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () => api<ProfileResp>(`/api/students/${id}`),
  });

  const addRecord = useMutation({
    mutationFn: () =>
      api(`/api/students/${id}/records`, {
        method: "POST",
        body: JSON.stringify({ text, type: recordType }),
      }),
    onSuccess: () => {
      setText("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["student", id] });
    },
    onError: (e) => setError(e.message),
  });

  if (isLoading || !data) return <Spinner label="加载学生档案…" />;
  const { student, kpStats } = data;

  const timeline: TimelineItem[] = [
    ...data.gradingTasks.map((t) => ({ kind: "task" as const, time: t.createdAt, task: t })),
    ...data.behaviorRecords.map((r) => ({ kind: "record" as const, time: r.createdAt, record: r })),
  ].sort((a, b) => +new Date(b.time) - +new Date(a.time));

  const weakKPs = kpStats.filter((k) => k.mastery < 60);

  return (
    <div className="space-y-5">
      <Link href="/students" className="text-sm text-indigo-600 hover:underline">
        ← 返回学生列表
      </Link>

      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar name={student.name} color={student.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-800">{student.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {data.gradeName} {data.className} · {student.gender} · {student.age} 岁
              {student.parentPhone && ` · 家长电话 ${student.parentPhone}`}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-indigo-600">{data.gradingTasks.length}</p>
              <p className="text-xs text-slate-400">批改次数</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600">{data.behaviorRecords.length}</p>
              <p className="text-xs text-slate-400">成长记录</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-500">{weakKPs.length}</p>
              <p className="text-xs text-slate-400">薄弱知识点</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader title="知识点掌握雷达" subtitle="基于 AI 批改结果的横向学情分析" />
            <div className="px-3 pb-3">
              {kpStats.length >= 3 ? (
                <MasteryRadar stats={kpStats} />
              ) : (
                <EmptyState icon="🎯" text="批改数据不足，多批改几次作业后生成雷达图" />
              )}
            </div>
            {kpStats.length > 0 && (
              <div className="px-5 pb-4 space-y-1.5">
                {kpStats.map((k) => (
                  <div key={k.kpId} className="flex items-center gap-2 text-sm">
                    <span className="w-28 truncate text-slate-600 text-xs">{k.kpName}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full",
                          k.mastery >= 80 ? "bg-emerald-500" : k.mastery >= 60 ? "bg-amber-400" : "bg-red-400"
                        )}
                        style={{ width: `${k.mastery}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-slate-500">{k.mastery}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="记一笔 · AI 行为分析"
              subtitle="输入碎片化观察，AI 抽取标签并生成结构化摘要"
            />
            <div className="px-5 pb-5 space-y-3">
              <div className="flex gap-2">
                {[
                  ["behavior", "课堂行为"],
                  ["homework", "作业表现"],
                  ["note", "随手记"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setRecordType(v)}
                    className={clsx(
                      "px-3 py-1 rounded-full text-xs",
                      recordType === v
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                className={inputCls + " h-24"}
                placeholder="例如：今天上课主动举手回答问题3次，但是午休时和同桌讲话被提醒了…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <Button onClick={() => addRecord.mutate()} disabled={addRecord.isPending || !text.trim()}>
                  {addRecord.isPending ? "AI 分析中…" : "✨ AI 分析并保存"}
                </Button>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="成长 Timeline" subtitle="日常记录 · 作业表现 · 自动汇聚" />
          <div className="px-5 pb-5">
            {timeline.length === 0 && <EmptyState icon="🗓️" text="暂无记录" />}
            <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
              {timeline.map((item) => (
                <div key={item.kind === "task" ? item.task.id : item.record.id} className="relative">
                  <span
                    className={clsx(
                      "absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-white",
                      item.kind === "task" ? "bg-indigo-500" : "bg-emerald-500"
                    )}
                  />
                  <p className="text-xs text-slate-400">{formatTime(item.time)}</p>
                  {item.kind === "task" ? (
                    <Link href={`/grading?task=${item.task.id}`} className="block mt-1 rounded-lg border border-slate-200 p-3 hover:border-indigo-300">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">
                          📷 {SUBJECT_LABELS[item.task.subject]}作业 AI 批改
                        </span>
                        {item.task.status === "success" ? (
                          <Badge
                            color={item.task.results.some((r) => !r.isCorrect) ? "red" : "green"}
                          >
                            {item.task.results.length} 题 / 错{" "}
                            {item.task.results.filter((r) => !r.isCorrect).length}
                          </Badge>
                        ) : (
                          <Badge color="amber">{item.task.status === "processing" ? "识别中" : "失败"}</Badge>
                        )}
                      </div>
                      {item.task.overallComment && (
                        <p className="text-xs text-slate-500 mt-1.5">{item.task.overallComment}</p>
                      )}
                    </Link>
                  ) : (
                    <div className="mt-1 rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">
                          {item.record.type === "behavior" ? "🌱 课堂行为" : item.record.type === "homework" ? "📝 作业表现" : "🗒️ 随手记"}
                        </span>
                        {item.record.tags.map((t) => (
                          <Badge
                            key={t.label}
                            color={t.sentiment === "positive" ? "green" : t.sentiment === "negative" ? "red" : "slate"}
                          >
                            {t.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">{item.record.rawText}</p>
                      <p className="text-xs text-indigo-700 bg-indigo-50 rounded p-2 mt-2">
                        🤖 {item.record.summary}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
