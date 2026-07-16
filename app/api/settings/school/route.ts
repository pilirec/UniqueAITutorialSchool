import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { schoolSettingsSchema, validateJson, validateImageDataUrl } from "@/lib/validation";
import { putImage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { mapSchool } from "@/lib/db";

/** 校区信息（名称 / Logo），仅校长可修改 */
export async function PUT(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可修改校区信息", 403);

  const body = await validateJson(req, schoolSettingsSchema);
  if (!body.ok) return jsonError(body.error);

  const update: { name?: string; logoSrc?: string } = {};
  if (body.data.name != null) {
    const name = body.data.name.trim();
    if (!name) return jsonError("校区名称不能为空");
    update.name = name;
  }

  if (body.data.logoDataUrl != null) {
    if (body.data.logoDataUrl === "") {
      update.logoSrc = "";
    } else {
      const img = validateImageDataUrl(body.data.logoDataUrl);
      if (!img.ok) return jsonError(img.error || "Logo 格式不正确");
      try {
        update.logoSrc = await putImage(`branding/logo_${Date.now()}`, body.data.logoDataUrl);
      } catch (e) {
        return jsonError(e instanceof Error ? `Logo 存储失败：${e.message}` : "Logo 存储失败", 502);
      }
    }
  }

  const school = await prisma.school.update({
    where: { id: user.schoolId },
    data: update,
  });

  await audit("school_updated", `school:${school.id}`, { fields: Object.keys(update) }, { teacherId: user.id, schoolId: user.schoolId });
  return NextResponse.json({ school: mapSchool(school) });
}
