import { chatCompletion, extractJSON } from "./client";
import { getProvider } from "./providers";
import type { AISettings, BehaviorTag } from "../types";

interface RawBehaviorOutput {
  tags?: Array<{ label?: string; sentiment?: string }>;
  summary?: string;
}

const PROMPT = `你是一名小学班主任助理。老师会输入关于某个学生的碎片化观察记录，请你：
1. 抽取行为标签（每个标签 2-6 个字），并标注正向(positive)/负向(negative)/中性(neutral)。
2. 生成一段面向老师的结构化摘要（60字以内），包含表现总结与教育建议。
只输出 JSON：
{"tags":[{"label":"课堂积极","sentiment":"positive"}],"summary":"..."}

老师的记录：`;

const POSITIVE_WORDS = [
  ["举手", "主动发言"], ["帮助", "乐于助人"], ["认真", "态度认真"], ["进步", "持续进步"],
  ["专注", "专注力好"], ["积极", "课堂积极"], ["按时", "作业按时"], ["耐心", "耐心细致"],
  ["响亮", "朗读出色"], ["礼貌", "文明礼貌"], ["订正", "订正认真"],
];
const NEGATIVE_WORDS = [
  ["讲话", "课堂纪律"], ["走神", "注意力分散"], ["粗心", "计算粗心"], ["迟到", "出勤问题"],
  ["拖拉", "作业拖拉"], ["吵", "纪律问题"], ["姿势", "坐姿握笔"], ["漏题", "审题不细"],
  ["打闹", "课间安全"],
];

function mockAnalyze(text: string): { tags: BehaviorTag[]; summary: string } {
  const tags: BehaviorTag[] = [];
  for (const [kw, label] of POSITIVE_WORDS) {
    if (text.includes(kw)) tags.push({ label, sentiment: "positive" });
  }
  for (const [kw, label] of NEGATIVE_WORDS) {
    if (text.includes(kw)) tags.push({ label, sentiment: "negative" });
  }
  if (tags.length === 0) tags.push({ label: "日常观察", sentiment: "neutral" });
  const pos = tags.filter((t) => t.sentiment === "positive").map((t) => t.label);
  const neg = tags.filter((t) => t.sentiment === "negative").map((t) => t.label);
  const parts: string[] = [];
  if (pos.length) parts.push(`表现亮点：${pos.join("、")}，建议及时表扬强化`);
  if (neg.length) parts.push(`待改进：${neg.join("、")}，建议温和提醒并持续关注`);
  if (!parts.length) parts.push("已记录日常观察，建议积累更多信息后综合评估");
  return { tags: tags.slice(0, 5), summary: parts.join("；") + "。（演示模型输出）" };
}

export async function runBehaviorAnalysis(
  settings: AISettings,
  text: string
): Promise<{ tags: BehaviorTag[]; summary: string }> {
  if (settings.provider === "mock") {
    await new Promise((r) => setTimeout(r, 800));
    return mockAnalyze(text);
  }

  const provider = getProvider(settings.provider);
  // 行为分析是纯文本任务，优先使用该提供商推荐的文本模型
  const textModel = provider.textModels?.[0] || settings.model;
  const raw = await chatCompletion(
    { ...settings, model: settings.model && !provider.textModels?.length ? settings.model : textModel },
    [{ role: "user", content: PROMPT + text }],
    { jsonMode: true }
  );
  const parsed = extractJSON<RawBehaviorOutput>(raw);
  const tags: BehaviorTag[] = (parsed.tags ?? [])
    .filter((t) => t.label)
    .map((t) => ({
      label: String(t.label),
      sentiment:
        t.sentiment === "positive" || t.sentiment === "negative" ? t.sentiment : "neutral",
    }));
  return {
    tags: tags.length ? tags : [{ label: "日常观察", sentiment: "neutral" }],
    summary: parsed.summary || "已生成记录。",
  };
}
