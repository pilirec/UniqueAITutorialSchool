"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBootstrap } from "@/lib/hooks";
import { api } from "@/lib/client-api";
import {
  Card,
  CardHeader,
  Button,
  Avatar,
  EmptyState,
  Spinner,
  Field,
  inputCls,
  Badge,
} from "@/components/ui";

export default function StudentsPage() {
  const { data: boot } = useBootstrap();
  const queryClient = useQueryClient();
  const [filterClass, setFilterClass] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // 单个创建表单
  const [form, setForm] = useState({ name: "", gender: "男", age: "8", parentPhone: "", classId: "" });
  // 批量导入
  const [importClassId, setImportClassId] = useState("");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");

  const createStudents = useMutation({
    mutationFn: (body: unknown) =>
      api<{ created: unknown[]; errors: string[] }>("/api/students", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      setError("");
      if (data.errors.length) {
        setImportResult(`成功导入 ${data.created.length} 名，${data.errors.length} 条失败：${data.errors.join("；")}`);
      } else {
        setImportResult(`成功导入 ${data.created.length} 名学生`);
        setShowCreate(false);
        setShowImport(false);
        setImportText("");
        setForm({ name: "", gender: "男", age: "8", parentPhone: "", classId: "" });
      }
    },
    onError: (e) => setError(e.message),
  });

  if (!boot) return <Spinner label="加载中…" />;

  const students =
    filterClass === "all"
      ? boot.students
      : boot.students.filter((s) => s.classId === filterClass);

  function submitSingle() {
    if (!form.name.trim() || !form.classId) {
      setError("请填写姓名并选择班级");
      return;
    }
    createStudents.mutate({ ...form, age: Number(form.age) });
  }

  function submitImport() {
    if (!importClassId) {
      setError("请选择导入的目标班级");
      return;
    }
    const rows = importText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, gender, age, parentPhone] = line.split(/[,，\t]/).map((s) => s?.trim());
        return { name, gender, age, parentPhone, classId: importClassId };
      });
    if (rows.length === 0) {
      setError("请粘贴学生数据");
      return;
    }
    createStudents.mutate({ students: rows });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">学生档案</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            数字化建档 · 共 {boot.students.length} 名学生（可见范围内）
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setShowImport(!showImport); setShowCreate(false); setImportResult(""); setError(""); }}>
            📥 批量导入
          </Button>
          <Button onClick={() => { setShowCreate(!showCreate); setShowImport(false); setImportResult(""); setError(""); }}>
            ＋ 新建学生
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader title="新建学生" />
          <div className="px-5 pb-5 grid sm:grid-cols-5 gap-3 items-end">
            <Field label="姓名">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="学生姓名" />
            </Field>
            <Field label="性别">
              <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>男</option>
                <option>女</option>
              </select>
            </Field>
            <Field label="年龄">
              <input className={inputCls} type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </Field>
            <Field label="家长电话">
              <input className={inputCls} value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} placeholder="选填" />
            </Field>
            <Field label="班级">
              <select className={inputCls} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">请选择</option>
                {boot.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-5 flex items-center gap-3">
              <Button onClick={submitSingle} disabled={createStudents.isPending}>
                {createStudents.isPending ? "创建中…" : "创建"}
              </Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {importResult && <p className="text-sm text-emerald-600">{importResult}</p>}
            </div>
          </div>
        </Card>
      )}

      {showImport && (
        <Card>
          <CardHeader
            title="批量导入学生"
            subtitle="从 Excel 复制后直接粘贴（每行：姓名，性别，年龄，家长电话），支持逗号或 Tab 分隔"
          />
          <div className="px-5 pb-5 space-y-3">
            <Field label="目标班级">
              <select className={inputCls} value={importClassId} onChange={(e) => setImportClassId(e.target.value)}>
                <option value="">请选择</option>
                {boot.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="学生数据">
              <textarea
                className={inputCls + " h-32 font-mono text-xs"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"李小明，男，8，13912345678\n王小红，女，8，13987654321"}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={submitImport} disabled={createStudents.isPending}>
                {createStudents.isPending ? "导入中…" : "开始导入"}
              </Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {importResult && <p className="text-sm text-emerald-600">{importResult}</p>}
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterClass("all")}
          className={
            filterClass === "all"
              ? "px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-medium"
              : "px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs"
          }
        >
          全部班级
        </button>
        {boot.classes.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterClass(c.id)}
            className={
              filterClass === c.id
                ? "px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-medium"
                : "px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs"
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      {students.length === 0 ? (
        <Card>
          <EmptyState icon="🧒" text="暂无学生，点击右上角新建或批量导入" />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {students.map((s) => {
            const cls = boot.classes.find((c) => c.id === s.classId);
            return (
              <Link key={s.id} href={`/students/${s.id}`}>
                <Card className="p-4 hover:border-indigo-300 hover:shadow transition-all">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} color={s.avatarColor} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cls?.name} · {s.gender} · {s.age} 岁
                      </p>
                    </div>
                    <Badge color="slate">档案 →</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
