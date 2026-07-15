import { NextResponse } from "next/server";
import { getDB, saveDB } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { putImage } from "@/lib/storage";

/** 校区信息（名称 / Logo），仅校长可修改 */
export async function PUT(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可修改校区信息", 403);

  const body = (await req.json()) as {
    name?: string;
    /** 新 Logo（data URL）；不传保持不变，传空字符串则清除 */
    logoDataUrl?: string;
  };
  const db = await getDB();

  if (body.name != null) {
    const name = body.name.trim();
    if (!name) return jsonError("校区名称不能为空");
    if (name.length > 30) return jsonError("校区名称不能超过 30 个字符");
    db.school.name = name;
  }

  if (body.logoDataUrl != null) {
    if (body.logoDataUrl === "") {
      db.school.logoSrc = "";
    } else if (body.logoDataUrl.startsWith("data:image/")) {
      try {
        db.school.logoSrc = await putImage(`branding/logo_${Date.now()}`, body.logoDataUrl);
      } catch (e) {
        return jsonError(e instanceof Error ? `Logo 存储失败：${e.message}` : "Logo 存储失败", 502);
      }
    } else {
      return jsonError("Logo 必须是图片");
    }
  }

  await saveDB();
  return NextResponse.json({ school: db.school });
}
