import { getProvider } from "./providers";
import type { AISettings } from "../types";

interface ChatMessageContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: "system" | "user";
  content: string | ChatMessageContentPart[];
}

/**
 * 通过 OpenAI 兼容协议调用任意提供商的 chat/completions。
 * 千问 VL、豆包、GLM、Kimi、Step、混元、DeepSeek、OpenAI、Gemini、
 * Claude、SiliconFlow、OpenRouter 等均支持该协议。
 */
export async function chatCompletion(
  settings: AISettings,
  messages: ChatMessage[],
  opts: { jsonMode?: boolean } = {}
): Promise<string> {
  const provider = getProvider(settings.provider);
  const baseUrl = (settings.baseUrl || provider.baseUrl).replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("未配置 Base URL");
  }
  if (!settings.apiKey) {
    throw new Error(`未配置 ${provider.label} 的 API Key，请在「AI 模型设置」中填写`);
  }

  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: 0.2,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 部分提供商不支持 response_format，降级重试一次
    if (opts.jsonMode && res.status === 400) {
      return chatCompletion(settings, messages, { jsonMode: false });
    }
    throw new Error(`模型调用失败（HTTP ${res.status}）：${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("模型返回内容为空");
  }
  return content;
}

export function visionMessage(prompt: string, imageDataUrl: string): ChatMessage[] {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

/** 从模型输出中稳健地提取 JSON（容忍 markdown 代码块、前后缀文本） */
export function extractJSON<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.search(/[[{]/);
    if (start >= 0) {
      const open = candidate[start];
      const close = open === "{" ? "}" : "]";
      const end = candidate.lastIndexOf(close);
      if (end > start) {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      }
    }
    throw new Error("无法从模型输出中解析 JSON");
  }
}
