"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useBootstrap } from "@/lib/hooks";
import { api, ROLE_LABELS } from "@/lib/client-api";
import { SYSTEM_NAME } from "@/lib/constants";
import { Spinner } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/", label: "工作台", icon: "🏠" },
  { href: "/grading", label: "拍照批改", icon: "📷" },
  { href: "/students", label: "学生档案", icon: "🧒" },
  { href: "/analytics", label: "学情看板", icon: "📈" },
  { href: "/org", label: "组织管理", icon: "🗂️" },
  { href: "/knowledge", label: "知识点", icon: "📚" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useBootstrap();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="加载中…" />
      </div>
    );
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen flex">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {data.school.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.school.logoSrc}
                alt="校区 Logo"
                className="w-8 h-8 rounded-lg object-contain shrink-0"
              />
            ) : (
              <span className="text-2xl">🎓</span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm leading-tight truncate">
                {data.school.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{SYSTEM_NAME} V1.0</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-semibold">
              {data.user.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {data.user.name}
              </p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[data.user.role]}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-xs text-slate-500 hover:text-red-500 text-left px-1"
          >
            退出登录 / 切换角色
          </button>
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {data.school.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.school.logoSrc}
                alt="校区 Logo"
                className="w-6 h-6 rounded object-contain shrink-0"
              />
            ) : (
              <span className="text-xl">🎓</span>
            )}
            <span className="font-bold text-sm text-slate-800 truncate">
              {data.school.name}
            </span>
          </div>
          <button onClick={logout} className="text-xs text-slate-500">
            {data.user.name} · 退出
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* 移动端底部导航（Mobile-First，PRD 4） */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 flex">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex-1 flex flex-col items-center py-2 text-[10px]",
                isActive(item.href) ? "text-indigo-600 font-semibold" : "text-slate-500"
              )}
            >
              <span className="text-lg leading-none mb-0.5">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
