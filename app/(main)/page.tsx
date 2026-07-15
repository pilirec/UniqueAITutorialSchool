"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useBootstrap } from "@/lib/hooks";
import { api, formatTime, SUBJECT_LABELS, ROLE_LABELS } from "@/lib/client-api";
import { Card, CardHeader, Badge, EmptyState, StatCard, Spinner } from "@/components/ui";
import { KPWrongRateBar } from "@/components/charts";
import type { GradingTask } from "@/lib/types";
import type { KPStat } from "@/lib/analytics";

interface AnalyticsResp {
  summary: { taskCount: number; totalQuestions: number; totalWrong: number; accuracy: number };
  kpStats: KPStat[];
  studentStats: Array<{ studentId: string; name: string; accuracy: number }>;
}

type TaskItem = Omit<GradingTask, "imageDataUrl"> & { hasImage: boolean };

export default function DashboardPage() {
  const { data: boot } = useBootstrap();
  const { data: analytics } = useQuery({
    queryKey: ["analytics", "all"],
    queryFn: () => api<AnalyticsResp>("/api/analytics?classId=all"),
  });
  const { data: taskData } = useQuery({
    queryKey: ["gradingTasks"],
    queryFn: () => api<{ tasks: TaskItem[] }>("/api/grading/tasks"),
    refetchInterval: 5000,
  });

  if (!boot) return <Spinner label="加载中…" />;

  const recentTasks = (taskData?.tasks ?? []).slice(0, 5);
  const scopeLabel =
    boot.user.role === "principal"
      ? "全校"
      : boot.user.role === "grade_leader"
        ? "本年级"
        : "本班";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {boot.user.name}，下午好 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {ROLE_LABELS[boot.user.role]} · 可见范围：{scopeLabel}（{boot.classes.length} 个班级 ·{" "}
            {boot.students.length} 名学生）
          </p>
        </div>
        <Link
          href="/grading"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 shadow-sm"
        >
          📷 拍照批改作业
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={`${scopeLabel}批改次数`} value={analytics?.summary.taskCount ?? "–"} hint="AI 拍照批改任务" />
        <StatCard label="累计批改题目" value={analytics?.summary.totalQuestions ?? "–"} accent="emerald" />
        <StatCard label="错题数" value={analytics?.summary.totalWrong ?? "–"} accent="red" hint="自动归因到知识点" />
        <StatCard label="整体正确率" value={analytics ? `${analytics.summary.accuracy}%` : "–"} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader
            title="高频错误知识点"
            subtitle={`${scopeLabel}错误率 Top 知识点（纵向统计）`}
            action={
              <Link href="/analytics" className="text-xs text-indigo-600 hover:underline">
                查看学情看板 →
              </Link>
            }
          />
          <div className="px-3 pb-3">
            {analytics && analytics.kpStats.length > 0 ? (
              <KPWrongRateBar stats={analytics.kpStats} />
            ) : (
              <EmptyState icon="📊" text="暂无批改数据，先去拍照批改一份作业吧" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="最近批改任务"
            subtitle="AI 异步批改 · 自动刷新"
            action={
              <Link href="/grading" className="text-xs text-indigo-600 hover:underline">
                全部任务 →
              </Link>
            }
          />
          <div className="px-5 pb-4 divide-y divide-slate-100">
            {recentTasks.length === 0 && <EmptyState icon="📷" text="还没有批改任务" />}
            {recentTasks.map((t) => {
              const student = boot.students.find((s) => s.id === t.studentId);
              const wrong = t.results.filter((r) => !r.isCorrect).length;
              return (
                <Link
                  key={t.id}
                  href={`/grading?task=${t.id}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                >
                  <span className="text-lg">{t.subject === "math" ? "🔢" : "📖"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {student?.name ?? "未关联学生"} · {SUBJECT_LABELS[t.subject]}作业
                    </span>
                    <span className="block text-xs text-slate-400">
                      {formatTime(t.createdAt)} · {t.provider === "mock" ? "演示模型" : t.model}
                    </span>
                  </span>
                  {t.status === "processing" && <Badge color="amber">识别中…</Badge>}
                  {t.status === "failed" && <Badge color="red">失败</Badge>}
                  {t.status === "success" && (
                    <Badge color={wrong > 0 ? "red" : "green"}>
                      {wrong > 0 ? `错 ${wrong} 题` : "全对"}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Link href="/students" className="group">
          <Card className="p-4 hover:border-indigo-300 transition-colors">
            <p className="text-2xl mb-1">🧒</p>
            <p className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600">学生数字化建档</p>
            <p className="text-xs text-slate-500 mt-1">Timeline 记录 · AI 行为分析 · 批量导入</p>
          </Card>
        </Link>
        <Link href="/knowledge" className="group">
          <Card className="p-4 hover:border-indigo-300 transition-colors">
            <p className="text-2xl mb-1">📚</p>
            <p className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600">知识点字典</p>
            <p className="text-xs text-slate-500 mt-1">预置 + 动态补充 · 教师提议 · 教研审核</p>
          </Card>
        </Link>
        <Link href="/settings" className="group">
          <Card className="p-4 hover:border-indigo-300 transition-colors">
            <p className="text-2xl mb-1">🤖</p>
            <p className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600">AI 模型设置</p>
            <p className="text-xs text-slate-500 mt-1">千问 VL / 豆包 / GLM / Kimi / GPT-4o 等 13+ 提供商</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
