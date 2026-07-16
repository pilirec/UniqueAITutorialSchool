import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserWithCsrf, jsonError } from "@/lib/api-helpers";
import { PROVIDERS, getProvider } from "@/lib/ai/providers";
import { getStorageDriverName } from "@/lib/storage";
import { encrypt, maskKey } from "@/lib/encryption";
import { aiSettingsSchema, validateJson } from "@/lib/validation";
import { audit } from "@/lib/audit";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const setting = await prisma.aISetting.findFirst();
  const masked = maskKey(setting?.apiKey ? "*" : ""); // 数据库中已加密，这里只告诉前端是否存在
  return NextResponse.json({
    providers: PROVIDERS,
    settings: {
      provider: setting?.provider ?? process.env.AI_PROVIDER ?? "mock",
      model: setting?.model ?? process.env.AI_MODEL ?? "",
      baseUrl: setting?.baseUrl ?? process.env.AI_BASE_URL ?? "",
      apiKeyMasked: masked,
      hasApiKey: Boolean(setting?.apiKey),
    },
    infra: {
      dbDriver: "prisma",
      storageDriver: getStorageDriverName(),
    },
  });
}

export async function PUT(req: Request) {
  const { user, error } = await requireUserWithCsrf(req);
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可修改 AI 模型配置", 403);

  const body = await validateJson(req, aiSettingsSchema);
  if (!body.ok) return jsonError(body.error);

  const provider = getProvider(body.data.provider);
  const model =
    body.data.model?.trim() || provider.visionModels[0] || provider.textModels?.[0] || "";
  const baseUrl = provider.id === "custom" ? (body.data.baseUrl?.trim() ?? "") : "";

  const setting = await prisma.aISetting.upsert({
    where: { schoolId: user.schoolId },
    create: {
      schoolId: user.schoolId,
      provider: provider.id,
      model,
      baseUrl,
      // 若未传入 apiKey，则为空
      apiKey: body.data.apiKey ? encrypt(body.data.apiKey.trim()) : "",
    },
    update: {
      provider: provider.id,
      model,
      baseUrl,
      ...(body.data.apiKey ? { apiKey: encrypt(body.data.apiKey.trim()) } : {}),
    },
  });

  await audit(
    "ai_settings_updated",
    `aiSetting:${setting.id}`,
    { provider: provider.id, model },
    { teacherId: user.id, schoolId: user.schoolId }
  );
  return NextResponse.json({ ok: true });
}
