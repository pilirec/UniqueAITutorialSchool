"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import type { KPStat } from "@/lib/analytics";

export function KPWrongRateBar({ stats }: { stats: KPStat[] }) {
  const data = stats.slice(0, 8).map((s) => ({
    name: s.kpName.length > 7 ? s.kpName.slice(0, 7) + "…" : s.kpName,
    fullName: s.kpName,
    错误率: Math.round(s.wrongRate * 100),
    题数: s.total,
  }));
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
        <Tooltip
          formatter={(value, key) =>
            key === "错误率" ? [`${value}%`, key] : [value ?? "", key]
          }
          labelFormatter={(label, payload) =>
            (payload?.[0]?.payload as { fullName?: string })?.fullName ?? label
          }
        />
        <Bar dataKey="错误率" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.错误率 >= 50 ? "#ef4444" : d.错误率 >= 25 ? "#f59e0b" : "#10b981"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MasteryRadar({ stats }: { stats: KPStat[] }) {
  const data = stats.slice(0, 8).map((s) => ({
    kp: s.kpName.length > 6 ? s.kpName.slice(0, 6) + "…" : s.kpName,
    掌握度: s.mastery,
  }));
  if (data.length < 3) return null;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid />
        <PolarAngleAxis dataKey="kp" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          dataKey="掌握度"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.35}
        />
        <Tooltip formatter={(v) => [`${v}%`, "掌握度"]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
