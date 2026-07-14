"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useBootstrap } from "@/lib/hooks";
import { api } from "@/lib/client-api";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Spinner,
  Field,
  inputCls,
  EmptyState,
} from "@/components/ui";
import type { KnowledgePoint, Subject } from "@/lib/types";

export default function KnowledgePage() {
  const { data: boot } = useBootstrap();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState<Subject>("math");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { data } = useQuery({
    queryKey: ["knowledgePoints"],
    queryFn: () => api<{ knowledgePoints: KnowledgePoint[] }>("/api/knowledge-points"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["knowledgePoints"] });
    queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  };

  const propose = useMutation({
    mutationFn: () =>
      api<KnowledgePoint>("/api/knowledge-points", {
        method: "POST",
        body: JSON.stringify({ name: newName, subject }),
      }),
    onSuccess: (kp) => {
      invalidate();
      setNewName("");
      setError("");
      setNotice(
        kp.status === "approved"
          ? `「${kp.name}」已直接入库`
          : `「${kp.name}」已提交，等待年级主任/教研审核`
      );
    },
    onError: (e) => setError(e.message),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api("/api/knowledge-points", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      }),
    onSuccess: () => invalidate(),
    onError: (e) => setError(e.message),
  });

  if (!boot || !data) return <Spinner label="加载中…" />;

  const kps = data.knowledgePoints.filter((k) => k.subject === subject);
  const pending = data.knowledgePoints.filter((k) => k.status === "pending");
  const canReview = boot.user.role !== "teacher";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">知识点字典</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          预置 + 动态补充：教师可提新增，年级主任/教研审核入库 · V1.0 聚焦数学 + 语文
        </p>
      </div>

      <div className="flex gap-2">
        {(["math", "chinese"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium",
              subject === s ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"
            )}
          >
            {s === "math" ? "🔢 数学" : "📖 语文"}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <Card className="lg:col-span-2">
          <CardHeader
            title={`${subject === "math" ? "数学" : "语文"}知识点（${kps.filter((k) => k.status === "approved").length} 个已入库）`}
            subtitle="AI 批改结果通过语义匹配对齐到标准知识点"
          />
          <div className="px-5 pb-5 flex flex-wrap gap-2">
            {kps.length === 0 && <EmptyState icon="📚" text="暂无知识点" />}
            {kps.map((k) => (
              <span
                key={k.id}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm",
                  k.status === "approved"
                    ? "border-slate-200 bg-white text-slate-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {k.name}
                {k.status === "pending" && <span className="text-[10px]">（待审核）</span>}
              </span>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="提议新增知识点"
              subtitle={canReview ? "您的角色可直接入库" : "提交后由年级主任/教研审核"}
            />
            <div className="px-5 pb-5 space-y-3">
              <Field label={`知识点名称（${subject === "math" ? "数学" : "语文"}）`}>
                <input
                  className={inputCls}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="如：三位数加减法"
                />
              </Field>
              <Button onClick={() => propose.mutate()} disabled={propose.isPending || !newName.trim()} className="w-full">
                {propose.isPending ? "提交中…" : "提交"}
              </Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {notice && <p className="text-sm text-emerald-600">{notice}</p>}
            </div>
          </Card>

          {canReview && (
            <Card>
              <CardHeader title="待审核" subtitle={`${pending.length} 条教师提议`} />
              <div className="px-5 pb-5 space-y-2">
                {pending.length === 0 && <p className="text-sm text-slate-400">暂无待审核项</p>}
                {pending.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{k.name}</p>
                      <p className="text-xs text-slate-400">
                        {k.subject === "math" ? "数学" : "语文"} · 提议人：
                        {boot.teachers.find((t) => t.id === k.proposedBy)?.name ?? "—"}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => review.mutate({ id: k.id, action: "approve" })}>
                      通过
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => review.mutate({ id: k.id, action: "reject" })}>
                      驳回
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              💡 生产版将采用 <Badge color="slate">Embedding 向量语义匹配</Badge>{" "}
              将 AI 识别出的知识点对齐到标准字典，低置信度自动进入人工审核（PRD 5.4）。原型采用字符串相似度匹配。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
