"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ROLE_LABELS } from "@/lib/client-api";
import { SYSTEM_NAME, DEFAULT_SCHOOL_NAME } from "@/lib/constants";
import { Spinner } from "@/components/ui";
import clsx from "clsx";

interface DemoAccount {
  id: string;
  name: string;
  role: string;
}

const ROLE_DESC: Record<string, string> = {
  principal: "查看全校数据 · 组织与教师管理 · AI 模型配置",
  grade_leader: "查看本年级数据 · 班级管理 · 知识点审核",
  teacher: "拍照批改 · 学生建档 · 本班学情",
};

const ROLE_ICON: Record<string, string> = {
  principal: "🏫",
  grade_leader: "📊",
  teacher: "👩‍🏫",
};

export default function LoginPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [logoSrc, setLogoSrc] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{
      user: DemoAccount | null;
      school: { name: string; logoSrc: string };
      demoAccounts: DemoAccount[];
    }>("/api/auth/me").then((data) => {
      if (data.user) {
        router.replace("/");
        return;
      }
      setSchoolName(data.school.name);
      setLogoSrc(data.school.logoSrc);
      setAccounts(data.demoAccounts);
      setSelected(data.demoAccounts[0]?.id ?? "");
    });
  }, [router]);

  async function handleLogin() {
    if (!selected || !password) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ teacherId: selected, password }),
      });
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="校区 Logo"
              className="w-14 h-14 rounded-xl object-contain mx-auto mb-2"
            />
          ) : (
            <div className="text-4xl mb-2">🎓</div>
          )}
          <h1 className="text-xl font-bold text-slate-800">
            {schoolName || DEFAULT_SCHOOL_NAME}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {SYSTEM_NAME} · 安全加固版（V1.0）
          </p>
        </div>

        {accounts.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spinner label="加载演示账号…" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-slate-500 mb-2">
              选择演示角色登录（体验 RBAC 数据可见范围）
            </p>
            <div className="space-y-2 mb-5">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                    selected === a.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="text-2xl">{ROLE_ICON[a.role]}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{a.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {ROLE_LABELS[a.role]}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 truncate">
                      {ROLE_DESC[a.role]}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "w-4 h-4 rounded-full border-2 shrink-0",
                      selected === a.id
                        ? "border-indigo-500 bg-indigo-500"
                        : "border-slate-300"
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                登录密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="默认密码：123456"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                演示账号默认密码为 123456，生产环境请务必修改
              </p>
            </div>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loading || !selected || !password}
              className="w-full rounded-xl bg-indigo-600 text-white font-semibold py-3 hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {loading ? "登录中…" : "进入系统"}
            </button>
            <p className="text-center text-xs text-slate-400 mt-4">
              已接入密码 + 服务端 Session + CSRF 防护
            </p>
          </>
        )}
      </div>
    </div>
  );
}
