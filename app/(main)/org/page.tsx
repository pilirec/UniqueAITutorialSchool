"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBootstrap } from "@/lib/hooks";
import { api, ROLE_LABELS } from "@/lib/client-api";
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
import type { Role } from "@/lib/types";

export default function OrgPage() {
  const { data: boot } = useBootstrap();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [className, setClassName] = useState("");
  const [classGradeId, setClassGradeId] = useState("");
  const [teacherForm, setTeacherForm] = useState({
    name: "",
    role: "teacher" as Role,
    phone: "",
    gradeId: "",
    classIds: [] as string[],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

  const orgMutation = useMutation({
    mutationFn: (body: unknown) =>
      api("/api/org", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      setError("");
      setGradeName("");
      setClassName("");
    },
    onError: (e) => setError(e.message),
  });

  const deleteOrg = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      api(`/api/org?type=${type}&id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setError("");
    },
    onError: (e) => setError(e.message),
  });

  const teacherMutation = useMutation({
    mutationFn: (body: unknown) =>
      api("/api/teachers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      setError("");
      setTeacherForm({ name: "", role: "teacher", phone: "", gradeId: "", classIds: [] });
    },
    onError: (e) => setError(e.message),
  });

  const deleteTeacher = useMutation({
    mutationFn: (id: string) => api(`/api/teachers?id=${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: (e) => setError(e.message),
  });

  if (!boot) return <Spinner label="加载中…" />;
  const canManage = boot.user.role !== "teacher";
  const isPrincipal = boot.user.role === "principal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">组织管理</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          组织树：年级 → 班级 · 教师与角色分配（当前角色：{ROLE_LABELS[boot.user.role]}）
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card>
          <CardHeader title="组织树" subtitle="年级与班级（支持动态增删）" />
          <div className="px-5 pb-5 space-y-4">
            {boot.grades.map((g) => {
              const classes = boot.classes.filter((c) => c.gradeId === g.id);
              return (
                <div key={g.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm text-slate-700">🏷️ {g.name}</p>
                    {isPrincipal && (
                      <Button size="sm" variant="ghost" onClick={() => deleteOrg.mutate({ type: "grade", id: g.id })}>
                        删除
                      </Button>
                    )}
                  </div>
                  {classes.length === 0 ? (
                    <p className="text-xs text-slate-400 pl-1">暂无班级</p>
                  ) : (
                    <div className="space-y-1.5">
                      {classes.map((c) => {
                        const head = boot.teachers.find((t) => t.id === c.headTeacherId);
                        const count = boot.students.filter((s) => s.classId === c.id).length;
                        return (
                          <div key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <span className="text-sm text-slate-700 flex-1">{c.name}</span>
                            <Badge color="indigo">{count} 名学生</Badge>
                            <Badge color="slate">班主任：{head?.name ?? "未分配"}</Badge>
                            {isPrincipal && (
                              <button
                                onClick={() => deleteOrg.mutate({ type: "class", id: c.id })}
                                className="text-xs text-slate-400 hover:text-red-500"
                              >
                                删除
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {canManage && (
              <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500">新增节点</p>
                {isPrincipal && (
                  <div className="flex gap-2 items-end">
                    <Field label="新增年级">
                      <input className={inputCls} value={gradeName} onChange={(e) => setGradeName(e.target.value)} placeholder="如：四年级" />
                    </Field>
                    <Button
                      variant="secondary"
                      disabled={orgMutation.isPending}
                      onClick={() => orgMutation.mutate({ type: "grade", name: gradeName })}
                    >
                      添加
                    </Button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <Field label="新增班级">
                    <input className={inputCls} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="如：二(3)班" />
                  </Field>
                  <Field label="所属年级">
                    <select className={inputCls} value={classGradeId} onChange={(e) => setClassGradeId(e.target.value)}>
                      <option value="">选择</option>
                      {boot.grades.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    variant="secondary"
                    disabled={orgMutation.isPending}
                    onClick={() => orgMutation.mutate({ type: "class", name: className, gradeId: classGradeId })}
                  >
                    添加
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="教师管理" subtitle="增删改查 + 角色 / 班级分配（仅校长可操作）" />
          <div className="px-5 pb-5 space-y-3">
            {boot.teachers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                <span className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-semibold">
                  {t.name.slice(0, 1)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {t.name}
                    {t.id === boot.user.id && <span className="text-xs text-indigo-500 ml-1">（我）</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.phone ?? "—"} ·{" "}
                    {t.role === "grade_leader"
                      ? `分管 ${boot.grades.find((g) => g.id === t.gradeId)?.name ?? "—"}`
                      : t.classIds.length
                        ? `任教 ${t.classIds.map((cid) => boot.classes.find((c) => c.id === cid)?.name).filter(Boolean).join("、")}`
                        : "未分配班级"}
                  </p>
                </div>
                <Badge color={t.role === "principal" ? "indigo" : t.role === "grade_leader" ? "sky" : "slate"}>
                  {ROLE_LABELS[t.role]}
                </Badge>
                {isPrincipal && t.id !== boot.user.id && (
                  <button
                    onClick={() => deleteTeacher.mutate(t.id)}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}

            {isPrincipal ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500">新增教师</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="姓名">
                    <input className={inputCls} value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} />
                  </Field>
                  <Field label="电话">
                    <input className={inputCls} value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
                  </Field>
                  <Field label="角色">
                    <select
                      className={inputCls}
                      value={teacherForm.role}
                      onChange={(e) => setTeacherForm({ ...teacherForm, role: e.target.value as Role })}
                    >
                      <option value="teacher">老师</option>
                      <option value="grade_leader">年级主任</option>
                    </select>
                  </Field>
                  {teacherForm.role === "grade_leader" ? (
                    <Field label="分管年级">
                      <select className={inputCls} value={teacherForm.gradeId} onChange={(e) => setTeacherForm({ ...teacherForm, gradeId: e.target.value })}>
                        <option value="">选择</option>
                        {boot.grades.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="任教班级">
                      <select
                        className={inputCls}
                        value={teacherForm.classIds[0] ?? ""}
                        onChange={(e) =>
                          setTeacherForm({ ...teacherForm, classIds: e.target.value ? [e.target.value] : [] })
                        }
                      >
                        <option value="">选择</option>
                        {boot.classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
                <Button
                  disabled={teacherMutation.isPending}
                  onClick={() => teacherMutation.mutate(teacherForm)}
                >
                  添加教师
                </Button>
              </div>
            ) : (
              <EmptyState icon="🔒" text="仅校长可新增或删除教师" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
