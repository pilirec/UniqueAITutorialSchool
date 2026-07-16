import { getProvider } from "./providers";
import { logger } from "../logger";
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

interface CircuitBreaker {
  failures: number;
  lastFailureAt: number;
  state: "closed" | "open" | "half-open";
}

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30_000;

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuit(provider: string): CircuitBreaker {
  let cb = circuitBreakers.get(provider);
  if (!cb) {
    cb = { failures: 0, lastFailureAt: 0, state: "closed" };
    circuitBreakers.set(provider, cb);
  }
  return cb;
}

function checkCircuit(provider: string): boolean {
  const cb = getCircuit(provider);
  if (cb.state === "open") {
    if (Date.now() - cb.lastFailureAt > CIRCUIT_OPEN_MS) {
      cb.state = "half-open";
      return true;
    }
    return false;
  }
  return true;
}

function recordCircuitResult(provider: string, success: boolean): void {
  const cb = getCircuit(provider);
  if (success) {
    cb.failures = 0;
    cb.state = "closed";
  } else {
    cb.failures += 1;
    cb.lastFailureAt = Date.now();
    if (cb.failures >= CIRCUIT_THRESHOLD) {
      cb.state = "open";
      logger.warn({ provider, failures: cb.failures }, "circuit breaker opened");
    }
  }
}

/**
 * 通过 OpenAI 兼容协议调用任意提供商的 chat/completions。
 * 增加断路器、限制递归降级次数、结构化日志与超时控制。
 */
export async function chatCompletion(
  settings: AISettings,
  messages: ChatMessage[],
  opts: { jsonMode?: boolean; retry?: number } = {}
): Promise<string> {
  const provider = getProvider(settings.provider);
  const baseUrl = (settings.baseUrl || provider.baseUrl).replace(/\/+$/, "");

  if (!checkCircuit(settings.provider)) {
    throw new Error(`模型服务 ${provider.label} 暂时不可用，请稍后重试（断路器打开）`);
  }

  if (!baseUrl && settings.provider !== "mock") {
    throw new Error("未配置 Base URL");
  }
  if (!settings.apiKey && settings.provider !== "mock") {
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

  const startedAt = Date.now();
  const url = `${baseUrl}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // 部分提供商不支持 response_format，降级重试一次
      if (opts.jsonMode && res.status === 400 && (opts.retry ?? 0) < 1) {
        logger.info(
          { provider: settings.provider, status: res.status, latencyMs },
          "json mode rejected, retrying without response_format"
        );
        return chatCompletion(settings, messages, { jsonMode: false, retry: (opts.retry ?? 0) + 1 });
      }
      recordCircuitResult(settings.provider, false);
      logger.warn(
        { provider: settings.provider, status: res.status, latencyMs, error: text.slice(0, 200) },
        "model call failed"
      );
      throw new Error(`模型调用失败（HTTP ${res.status}）：${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      recordCircuitResult(settings.provider, false);
      throw new Error("模型返回内容为空");
    }

    recordCircuitResult(settings.provider, true);
    logger.info(
      {
        provider: settings.provider,
        model: data.model ?? settings.model,
        latencyMs,
        tokens: data.usage?.total_tokens,
      },
      "model call success"
    );
    return content;
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      recordCircuitResult(settings.provider, false);
      logger.warn({ provider: settings.provider, latencyMs: Date.now() - startedAt }, "model call timeout");
      throw new Error("模型调用超时（120s），请稍后重试");
    }
    throw e;
  }
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
