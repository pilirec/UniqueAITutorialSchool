"use client";

import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("bg-white rounded-xl border border-slate-200 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-5 pt-4 pb-2">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-700",
        variant === "secondary" &&
          "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
        variant === "danger" && "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: "green" | "red" | "amber" | "indigo" | "slate" | "sky";
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-600 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        colors[color]
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full text-white font-medium shrink-0",
        size === "sm" && "w-7 h-7 text-xs",
        size === "md" && "w-9 h-9 text-sm",
        size === "lg" && "w-14 h-14 text-lg"
      )}
      style={{ backgroundColor: color }}
    >
      {name.slice(-2)}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500 text-sm">
      <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      {label}
    </span>
  );
}

export function EmptyState({ icon, text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <span className="text-3xl mb-2">{icon ?? "📭"}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white";

export function StatCard({
  label,
  value,
  hint,
  accent = "indigo",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "indigo" | "emerald" | "red" | "amber";
}) {
  const accents = {
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    red: "text-red-500",
    amber: "text-amber-600",
  };
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1", accents[accent])}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </Card>
  );
}
