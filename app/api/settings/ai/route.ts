import { NextResponse } from "next/server";
import { getDB, saveDB, getPersistence } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { PROVIDERS, getProvider } from "@/lib/ai/providers";
import { getStorageDriverName } from "@/lib/storage";

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const db = await getDB();
  return NextResponse.json({
    providers: PROVIDERS,
    settings: {
      provider: db.aiSettings.provider,
      model: db.aiSettings.model,
      baseUrl: db.aiSettings.baseUrl,
      apiKeyMasked: maskKey(db.aiSettings.apiKey),
      hasApiKey: Boolean(db.aiSettings.apiKey),
    },
    infra: {
      dbDriver: getPersistence().name,
      storageDriver: getStorageDriverName(),
    },
  });
}

export async function PUT(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "principal") return jsonError("仅校长可修改 AI 模型配置", 403);

  const body = (await req.json()) as {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  const db = await getDB();
  const provider = getProvider(body.provider ?? "mock");

  db.aiSettings.provider = provider.id;
  db.aiSettings.model =
    body.model?.trim() || provider.visionModels[0] || provider.textModels?.[0] || "";
  db.aiSettings.baseUrl = provider.id === "custom" ? (body.baseUrl?.trim() ?? "") : "";
  // 留空表示保持原 Key 不变；填写则覆盖
  if (body.apiKey != null && body.apiKey !== "") {
    db.aiSettings.apiKey = body.apiKey.trim();
  }
  if (provider.id === "mock") {
    db.aiSettings.apiKey = db.aiSettings.apiKey || "";
  }
  await saveDB();
  return NextResponse.json({ ok: true });
}
