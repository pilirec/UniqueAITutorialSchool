import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import { SYSTEM_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: SYSTEM_NAME,
  description: `${SYSTEM_NAME} · AI 驱动的托辅班教学管理平台原型（拍照批改 / 学情分析 / 学生建档）`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-slate-100 text-slate-800">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
