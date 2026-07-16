import { NextResponse } from "next/server";
import { dispatchGradingJobs } from "@/lib/jobs";
import { recoverStalledJobs } from "@/lib/queue";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 定时任务触发点，建议每 1 分钟调用一次（Vercel Cron / 自建 cron）。
 * 保护：通过 CRON_SECRET 验证，防止被恶意触发。
 */
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const recovered = await recoverStalledJobs(10 * 60 * 1000);
    const ran = await dispatchGradingJobs();
    logger.info({ recovered, ran }, "cron queue processed");
    return NextResponse.json({ ok: true, recovered, ran });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logger.error({ err }, "cron queue failed");
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
