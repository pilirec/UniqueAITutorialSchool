export interface ProviderDef {
  id: string;
  label: string;
  vendor: string;
  baseUrl: string;
  /** 推荐的视觉模型（识图查题/拍照批改） */
  visionModels: string[];
  /** 推荐的文本模型（行为分析等），为空则复用视觉模型 */
  textModels?: string[];
  /** 是否支持图像输入 */
  vision: boolean;
  keyHint?: string;
  docsUrl?: string;
}

/**
 * 多模态 / 大模型提供商注册表。
 * 全部通过 OpenAI 兼容的 /chat/completions 协议接入，
 * 支持国产 VLM（千问 VL、豆包 Seed）及更广泛的国内外模型与聚合平台。
 */
export const PROVIDERS: ProviderDef[] = [
  {
    id: "mock",
    label: "内置演示模型（无需 API Key）",
    vendor: "本地",
    baseUrl: "",
    visionModels: ["demo-vision"],
    textModels: ["demo-text"],
    vision: true,
    keyHint: "无需配置，返回确定性演示结果",
  },
  {
    id: "qwen",
    label: "通义千问 Qwen-VL / Qwen3-VL",
    vendor: "阿里云百炼 DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    visionModels: ["qwen3-vl-plus", "qwen-vl-max", "qwen-vl-plus"],
    textModels: ["qwen-plus", "qwen-max"],
    vision: true,
    keyHint: "DASHSCOPE_API_KEY（sk-...）",
    docsUrl: "https://help.aliyun.com/zh/model-studio/",
  },
  {
    id: "doubao",
    label: "豆包 Doubao Seed Vision",
    vendor: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    visionModels: ["doubao-seed-1-6-vision-250815", "doubao-1-5-vision-pro-32k-250115"],
    textModels: ["doubao-seed-1-6-250615"],
    vision: true,
    keyHint: "ARK_API_KEY，模型名也可填推理接入点 ep-...",
    docsUrl: "https://www.volcengine.com/docs/82379",
  },
  {
    id: "glm",
    label: "智谱 GLM-4.5V / GLM-4V",
    vendor: "智谱 AI",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    visionModels: ["glm-4.5v", "glm-4v-plus-0111"],
    textModels: ["glm-4.5", "glm-4-air"],
    vision: true,
    keyHint: "智谱开放平台 API Key",
    docsUrl: "https://open.bigmodel.cn/",
  },
  {
    id: "moonshot",
    label: "月之暗面 Kimi (Vision)",
    vendor: "Moonshot AI",
    baseUrl: "https://api.moonshot.cn/v1",
    visionModels: ["moonshot-v1-32k-vision-preview", "kimi-latest"],
    textModels: ["kimi-k2-0711-preview", "moonshot-v1-32k"],
    vision: true,
    keyHint: "MOONSHOT_API_KEY（sk-...）",
    docsUrl: "https://platform.moonshot.cn/",
  },
  {
    id: "stepfun",
    label: "阶跃星辰 Step-1V",
    vendor: "StepFun",
    baseUrl: "https://api.stepfun.com/v1",
    visionModels: ["step-1v-32k", "step-1o-turbo-vision"],
    textModels: ["step-2-16k"],
    vision: true,
    keyHint: "StepFun API Key",
    docsUrl: "https://platform.stepfun.com/",
  },
  {
    id: "hunyuan",
    label: "腾讯混元 Vision",
    vendor: "腾讯云",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    visionModels: ["hunyuan-turbos-vision", "hunyuan-vision"],
    textModels: ["hunyuan-turbos-latest"],
    vision: true,
    keyHint: "腾讯云混元 API Key",
    docsUrl: "https://cloud.tencent.com/document/product/1729",
  },
  {
    id: "deepseek",
    label: "DeepSeek（仅文本，用于行为分析）",
    vendor: "深度求索",
    baseUrl: "https://api.deepseek.com/v1",
    visionModels: [],
    textModels: ["deepseek-chat", "deepseek-reasoner"],
    vision: false,
    keyHint: "DeepSeek API Key（不支持识图，仅可用于行为分析）",
    docsUrl: "https://platform.deepseek.com/",
  },
  {
    id: "openai",
    label: "OpenAI GPT-4o / GPT-4.1",
    vendor: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    visionModels: ["gpt-4o", "gpt-4.1", "gpt-4o-mini"],
    textModels: ["gpt-4o-mini"],
    vision: true,
    keyHint: "OPENAI_API_KEY（sk-...）",
    docsUrl: "https://platform.openai.com/",
  },
  {
    id: "gemini",
    label: "Google Gemini 2.5",
    vendor: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    visionModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    textModels: ["gemini-2.5-flash"],
    vision: true,
    keyHint: "Google AI Studio API Key",
    docsUrl: "https://ai.google.dev/",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    vendor: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    visionModels: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
    textModels: ["claude-3-5-haiku-20241022"],
    vision: true,
    keyHint: "ANTHROPIC_API_KEY（OpenAI 兼容接口）",
    docsUrl: "https://docs.anthropic.com/",
  },
  {
    id: "siliconflow",
    label: "硅基流动 SiliconFlow（聚合）",
    vendor: "聚合平台",
    baseUrl: "https://api.siliconflow.cn/v1",
    visionModels: ["Qwen/Qwen2.5-VL-72B-Instruct", "THUDM/GLM-4.1V-9B-Thinking"],
    textModels: ["deepseek-ai/DeepSeek-V3"],
    vision: true,
    keyHint: "SiliconFlow API Key，可访问 Qwen/GLM/DeepSeek 等开源模型",
    docsUrl: "https://siliconflow.cn/",
  },
  {
    id: "openrouter",
    label: "OpenRouter（聚合）",
    vendor: "聚合平台",
    baseUrl: "https://openrouter.ai/api/v1",
    visionModels: ["qwen/qwen2.5-vl-72b-instruct", "google/gemini-2.5-flash", "openai/gpt-4o"],
    textModels: ["deepseek/deepseek-chat-v3-0324"],
    vision: true,
    keyHint: "OpenRouter API Key，一个 Key 访问数百个模型",
    docsUrl: "https://openrouter.ai/",
  },
  {
    id: "custom",
    label: "自定义（OpenAI 兼容接口）",
    vendor: "自定义",
    baseUrl: "",
    visionModels: [],
    textModels: [],
    vision: true,
    keyHint: "填写任意 OpenAI 兼容服务的 Base URL、模型名与 API Key（如 Ollama、vLLM、LiteLLM）",
  },
];

export function getProvider(id: string): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
