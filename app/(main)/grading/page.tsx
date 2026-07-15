"use client";

import { useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useBootstrap } from "@/lib/hooks";
import { api, compressImage, formatTime, SUBJECT_LABELS } from "@/lib/client-api";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  EmptyState,
  Spinner,
  Field,
  inputCls,
} from "@/components/ui";
import type { GradingTask, Subject } from "@/lib/types";

type TaskItem = Omit<GradingTask, "imageDataUrl"> & {
  hasImage: boolean;
  imageDataUrl?: string;
};

function GradingPageInner() {
  const { data: boot } = useBootstrap();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const [imageName, setImageName] = useState("");
  const [subject, setSubject] = useState<Subject>("math");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");

  const { data: taskData } = useQuery({
    queryKey: ["gradingTasks"],
    queryFn: () => api<{ tasks: TaskItem[] }>("/api/grading/tasks"),
    refetchInterval: (q) =>
      q.state.data?.tasks.some((t) => t.status === "processing") ? 2000 : false,
  });

  const { data: detail } = useQuery({
    queryKey: ["gradingTask", selectedTaskId],
    queryFn: () =>
      api<{ task: TaskItem }>(`/api/grading/tasks/${selectedTaskId}?image=1`),
    enabled: Boolean(selectedTaskId),
    refetchInterval: (q) =>
      q.state.data?.task.status === "processing" ? 2000 : false,
  });

  const createTask = useMutation({
    mutationFn: (body: {
      imageDataUrl: string;
      imageName: string;
      studentId?: string;
      subject: Subject;
    }) =>
      api<{ task: TaskItem; deduplicated?: boolean }>("/api/grading/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gradingTasks"] });
      setPreview("");
      setImageName("");
      if (fileRef.current) fileRef.current.value = "";
      router.replace(`/grading?task=${data.task.id}`);
    },
    onError: (e) => setError(e.message),
  });

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      setImageName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片处理失败");
    }
  }

  function submit() {
    if (!preview) {
      setError("请先拍照或选择作业照片");
      return;
    }
    setError("");
    createTask.mutate({
      imageDataUrl: preview,
      imageName,
      studentId: studentId || undefined,
      subject,
    });
  }

  if (!boot) return <Spinner label="加载中…" />;
  const tasks = taskData?.tasks ?? [];
  const task = detail?.task;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">AI 拍照批改</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          拍照上传 → AI 异步识别 → 结构化结果入库（错题自动归因到知识点）
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 items-start">
        {/* 上传区 */}
        <Card className="lg:col-span-2">
          <CardHeader title="上传作业照片" subtitle="支持手机拍照 · 自动压缩" />
          <div className="px-5 pb-5 space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className={clsx(
                "w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors overflow-hidden",
                preview
                  ? "border-indigo-300 bg-indigo-50/40 p-2"
                  : "border-slate-300 hover:border-indigo-400 py-10"
              )}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="作业预览" className="max-h-56 rounded-lg" />
              ) : (
                <>
                  <span className="text-3xl mb-2">📷</span>
                  <span className="text-sm font-medium text-slate-600">
                    点击拍照 / 选择图片
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    JPG/PNG · 自动压缩至 1280px
                  </span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Field label="学科">
                <select
                  className={inputCls}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as Subject)}
                >
                  <option value="math">数学</option>
                  <option value="chinese">语文</option>
                </select>
              </Field>
              <Field label="关联学生（可选）">
                <select
                  className={inputCls}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">不关联</option>
                  {boot.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {boot.classes.find((c) => c.id === s.classId)?.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              onClick={submit}
              disabled={createTask.isPending || !preview}
              className="w-full"
            >
              {createTask.isPending ? "提交中…" : "🚀 提交 AI 批改"}
            </Button>
            <p className="text-xs text-slate-400">
              幂等控制：同一教师重复上传相同照片将复用已有任务（teacher_id + image_md5）
            </p>
          </div>
        </Card>

        {/* 结果详情 */}
        <Card className="lg:col-span-3">
          <CardHeader
            title={task ? "批改结果" : "任务详情"}
            subtitle={
              task
                ? `${formatTime(task.createdAt)} · ${
                    task.provider === "mock" ? "内置演示模型" : `${task.provider} / ${task.model}`
                  }`
                : "点击下方任务查看详情"
            }
          />
          <div className="px-5 pb-5">
            {!task && <EmptyState icon="🔍" text="选择一个任务查看 AI 批改结果" />}
            {task?.status === "processing" && (
              <div className="flex flex-col items-center py-10 gap-3">
                <Spinner label="AI 正在识别与批改，请稍候…（异步任务轮询中）" />
                <p className="text-xs text-slate-400">
                  生产环境由 Celery + Redis 队列执行，原型为服务端异步任务
                </p>
              </div>
            )}
            {task?.status === "failed" && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                批改失败：{task.error}
              </div>
            )}
            {task?.status === "success" && (
              <div className="space-y-3">
                {task.imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={task.imageDataUrl}
                    alt="作业照片"
                    className="max-h-44 rounded-lg border border-slate-200"
                  />
                )}
                {task.overallComment && (
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-sm text-indigo-800">
                    💬 {task.overallComment}
                  </div>
                )}
                <div className="space-y-2">
                  {task.results.map((r) => (
                    <div
                      key={r.questionId}
                      className={clsx(
                        "rounded-lg border p-3",
                        r.isCorrect
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-red-200 bg-red-50/50"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">
                          {r.questionId}
                        </span>
                        <Badge color={r.isCorrect ? "green" : "red"}>
                          {r.isCorrect ? "✓ 正确" : "✗ 错误"}
                        </Badge>
                        {r.matchedKnowledgePoint && (
                          <Badge color="indigo">{r.matchedKnowledgePoint.name}</Badge>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">
                          置信度 {(r.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      {r.questionText && (
                        <p className="text-sm text-slate-700 mt-2">{r.questionText}</p>
                      )}
                      <p className="text-sm mt-1.5">
                        <span className="text-slate-500">学生答案：</span>
                        <span className={r.isCorrect ? "text-emerald-700" : "text-red-600"}>
                          {r.studentAnswer || "（未作答）"}
                        </span>
                        {!r.isCorrect && r.correctAnswer && (
                          <span className="text-slate-500 ml-3">
                            正确答案：
                            <span className="text-emerald-700">{r.correctAnswer}</span>
                          </span>
                        )}
                      </p>
                      {!r.isCorrect && (
                        <p className="text-xs text-slate-600 mt-1.5 bg-white/70 rounded p-2">
                          🔎 {r.analysis}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader
          title="批改任务队列"
          subtitle="晚高峰批量请求排队执行，前端轮询任务状态（PRD 第 6 节）"
        />
        <div className="px-5 pb-4 overflow-x-auto">
          {tasks.length === 0 ? (
            <EmptyState icon="📋" text="暂无批改任务" />
          ) : (
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">时间</th>
                  <th className="py-2 pr-3 font-medium">学生</th>
                  <th className="py-2 pr-3 font-medium">学科</th>
                  <th className="py-2 pr-3 font-medium">模型</th>
                  <th className="py-2 pr-3 font-medium">结果</th>
                  <th className="py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const student = boot.students.find((s) => s.id === t.studentId);
                  const wrong = t.results.filter((r) => !r.isCorrect).length;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.replace(`/grading?task=${t.id}`)}
                      className={clsx(
                        "border-b border-slate-50 cursor-pointer hover:bg-slate-50",
                        selectedTaskId === t.id && "bg-indigo-50/60"
                      )}
                    >
                      <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                        {formatTime(t.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3">{student?.name ?? "—"}</td>
                      <td className="py-2.5 pr-3">{SUBJECT_LABELS[t.subject]}</td>
                      <td className="py-2.5 pr-3 text-slate-500 text-xs">
                        {t.provider === "mock" ? "演示模型" : t.model}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">
                        {t.status === "success"
                          ? `${t.results.length} 题 / 错 ${wrong}`
                          : "—"}
                      </td>
                      <td className="py-2.5">
                        {t.status === "processing" && <Badge color="amber">识别中</Badge>}
                        {t.status === "success" && <Badge color="green">完成</Badge>}
                        {t.status === "failed" && <Badge color="red">失败</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function GradingPage() {
  return (
    <Suspense fallback={<Spinner label="加载中…" />}>
      <GradingPageInner />
    </Suspense>
  );
}
