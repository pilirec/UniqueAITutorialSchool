"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useBootstrap } from "@/lib/hooks";
import { api } from "@/lib/client-api";
import { Card, CardHeader, EmptyState, Spinner, StatCard, Avatar, Badge } from "@/components/ui";
import { KPWrongRateBar } from "@/components/charts";
import type { KPStat } from "@/lib/analytics";

interface AnalyticsResp {
  summary: { taskCount: number; totalQuestions: number; totalWrong: number; accuracy: number };
  kpStats: KPStat[];
  studentStats: Array<{
    studentId: string;
    name: string;
    className: string;
    avatarColor: string;
    total: number;
    wrong: number;
    accuracy: number;
  }>;
}

export default function AnalyticsPage() {
  const { data: boot } = useBootstrap();
  const [classId, setClassId] = useState("all");
  const { data } = useQuery({
    queryKey: ["analytics", classId],
    queryFn: () => api<AnalyticsResp>(`/api/analytics?classId=${classId}`),
  });

  if (!boot) return <Spinner label="加载中…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">学情看板</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          纵向：题目错误率 + 高频知识点 · 横向：学生个人掌握情况
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setClassId("all")}
          className={clsx(
            "px-3 py-1.5 rounded-full text-xs font-medium",
            classId === "all" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"
          )}
        >
          可见范围全部
        </button>
        {boot.classes.map((c) => (
          <button
            key={c.id}
            onClick={() => setClassId(c.id)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-medium",
              classId === c.id ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="批改任务" value={data?.summary.taskCount ?? "–"} />
        <StatCard label="批改题目" value={data?.summary.totalQuestions ?? "–"} accent="emerald" />
        <StatCard label="错题" value={data?.summary.totalWrong ?? "–"} accent="red" />
        <StatCard label="正确率" value={data ? `${data.summary.accuracy}%` : "–"} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card>
          <CardHeader title="错题 Top 知识点" subtitle="错误率越高越靠前，红色为重点讲评项" />
          <div className="px-3 pb-3">
            {data && data.kpStats.length > 0 ? (
              <KPWrongRateBar stats={data.kpStats} />
            ) : (
              <EmptyState icon="📊" text="该范围暂无批改数据" />
            )}
          </div>
          {data && data.kpStats.length > 0 && (
            <div className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="py-1.5 font-medium">知识点</th>
                    <th className="py-1.5 font-medium">学科</th>
                    <th className="py-1.5 font-medium text-right">题数</th>
                    <th className="py-1.5 font-medium text-right">错误率</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kpStats.slice(0, 10).map((k) => (
                    <tr key={k.kpId} className="border-b border-slate-50">
                      <td className="py-2">{k.kpName}</td>
                      <td className="py-2">
                        <Badge color={k.subject === "math" ? "sky" : "amber"}>
                          {k.subject === "math" ? "数学" : "语文"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-slate-500">{k.total}</td>
                      <td
                        className={clsx(
                          "py-2 text-right font-medium",
                          k.wrongRate >= 0.5 ? "text-red-500" : k.wrongRate >= 0.25 ? "text-amber-600" : "text-emerald-600"
                        )}
                      >
                        {Math.round(k.wrongRate * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="学生掌握情况" subtitle="按正确率升序，最需要关注的学生排在前面" />
          <div className="px-5 pb-4">
            {!data || data.studentStats.length === 0 ? (
              <EmptyState icon="🧒" text="该范围暂无学生批改数据" />
            ) : (
              <div className="space-y-2">
                {data.studentStats.map((s) => (
                  <Link
                    key={s.studentId}
                    href={`/students/${s.studentId}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 hover:border-indigo-200"
                  >
                    <Avatar name={s.name} color={s.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {s.name}
                        <span className="text-xs text-slate-400 ml-2">{s.className}</span>
                      </p>
                      <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-full",
                            s.accuracy >= 80 ? "bg-emerald-500" : s.accuracy >= 60 ? "bg-amber-400" : "bg-red-400"
                          )}
                          style={{ width: `${s.accuracy}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={clsx(
                          "text-sm font-bold",
                          s.accuracy >= 80 ? "text-emerald-600" : s.accuracy >= 60 ? "text-amber-600" : "text-red-500"
                        )}
                      >
                        {s.accuracy}%
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {s.total} 题 / 错 {s.wrong}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
