import { chatCompletion, visionMessage, extractJSON } from "./client";
import type {
  AISettings,
  GradingResultItem,
  KnowledgePoint,
  Subject,
} from "../types";

interface RawGradedQuestion {
  question_id?: string;
  question_text?: string;
  is_correct?: boolean;
  student_answer?: string;
  correct_answer?: string;
  analysis?: string;
  knowledge_point?: string;
  confidence?: number;
}

interface RawGradingOutput {
  questions?: RawGradedQuestion[];
  overall_comment?: string;
}

function buildPrompt(subject: Subject, kps: KnowledgePoint[]): string {
  const subjectName = subject === "math" ? "数学" : "语文";
  const dict = kps
    .filter((k) => k.subject === subject && k.status === "approved")
    .map((k) => `- ${k.name}`)
    .join("\n");
  return `你是一名小学${subjectName}老师，请批改这张作业照片。

要求：
1. 逐题识别学生的手写答案，判断对错。
2. 对每道错题给出简洁的错因分析（面向老师，50字以内）。
3. 为每题从下面的知识点字典中选择最匹配的一个知识点（必须原样使用字典中的名称）：
${dict}
4. 只输出 JSON，不要输出任何其他内容，格式如下：
{
  "questions": [
    {
      "question_id": "Q001",
      "question_text": "题干（简要）",
      "is_correct": false,
      "student_answer": "学生答案",
      "correct_answer": "正确答案",
      "analysis": "错因分析",
      "knowledge_point": "知识点名称（必须来自字典）",
      "confidence": 0.9
    }
  ],
  "overall_comment": "整体点评（一句话）"
}`;
}

/** 知识点匹配：精确 → 包含 → 字符重叠度（原型用字符串匹配，生产版将使用 Embedding 检索，见 PRD 5.4） */
export function matchKnowledgePoint(
  name: string | undefined,
  subject: Subject,
  kps: KnowledgePoint[]
): KnowledgePoint | null {
  const pool = kps.filter((k) => k.subject === subject && k.status === "approved");
  if (!name) return null;
  const exact = pool.find((k) => k.name === name);
  if (exact) return exact;
  const contains = pool.find((k) => k.name.includes(name) || name.includes(k.name));
  if (contains) return contains;
  let best: KnowledgePoint | null = null;
  let bestScore = 0;
  for (const k of pool) {
    const overlap = [...name].filter((ch) => k.name.includes(ch)).length;
    const score = overlap / Math.max(k.name.length, name.length);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return bestScore >= 0.3 ? best : null;
}

function normalizeResults(
  raw: RawGradingOutput,
  subject: Subject,
  kps: KnowledgePoint[]
): { results: GradingResultItem[]; overallComment: string } {
  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  if (questions.length === 0) {
    throw new Error("模型未识别出任何题目，请确认照片清晰且包含作业内容");
  }
  const results = questions.map((q, i) => {
    const kp = matchKnowledgePoint(q.knowledge_point, subject, kps);
    return {
      questionId: q.question_id || `Q${String(i + 1).padStart(3, "0")}`,
      questionText: q.question_text,
      isCorrect: Boolean(q.is_correct),
      studentAnswer: String(q.student_answer ?? ""),
      correctAnswer: q.correct_answer != null ? String(q.correct_answer) : undefined,
      analysis: q.analysis || (q.is_correct ? "回答正确。" : "回答有误。"),
      matchedKnowledgePoint: kp
        ? { id: kp.id, name: kp.name, subject: kp.subject }
        : null,
      confidence: typeof q.confidence === "number" ? Math.min(1, Math.max(0, q.confidence)) : 0.8,
    } satisfies GradingResultItem;
  });
  return {
    results,
    overallComment: raw.overall_comment || "",
  };
}

/** 内置演示模型：基于图片哈希生成确定性的批改结果，零配置可用 */
function mockGrade(
  imageMd5: string,
  subject: Subject,
  kps: KnowledgePoint[]
): { results: GradingResultItem[]; overallComment: string } {
  const seed = [...imageMd5].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pool = kps.filter((k) => k.subject === subject && k.status === "approved");
  const nQ = 3 + (seed % 3);

  const mathSamples = [
    { text: "16 × 2 =", right: "32", wrongs: ["28", "30"], analysis: "个位相乘后进位处理错误，6×2=12 应向十位进 1。", kp: "两位数乘法" },
    { text: "73 − 12 =", right: "61", wrongs: ["51", "65"], analysis: "不需要退位却误退位，十位计算出错。", kp: "退位减法" },
    { text: "52 ÷ 7 =", right: "7余3", wrongs: ["7余2", "6余10"], analysis: "余数计算错误，52−49=3。", kp: "有余数的除法" },
    { text: "38 + 25 =", right: "63", wrongs: ["53", "62"], analysis: "进位加法漏加进位 1。", kp: "进位加法" },
    { text: "1米 = ( )厘米", right: "100", wrongs: ["10", "1000"], analysis: "长度单位换算进率记忆不牢。", kp: "长度单位换算" },
    { text: "小明有12支笔，是小红的3倍，小红有几支？", right: "4", wrongs: ["36", "9"], analysis: "倍数关系理解反了，应为 12÷3。", kp: "应用题·倍数关系" },
  ];
  const chnSamples = [
    { text: "「认识」的「识」", right: "识", wrongs: ["帜", "织"], analysis: "形近字混淆，注意言字旁与巾字旁的区别。", kp: "形近字辨析" },
    { text: "一（ ）鱼", right: "条", wrongs: ["只", "个"], analysis: "量词搭配不当，鱼用「条」。", kp: "量词搭配" },
    { text: "「长」在「长大」中读", right: "zhǎng", wrongs: ["cháng"], analysis: "多音字辨析错误，表示生长时读 zhǎng。", kp: "多音字" },
    { text: "照样子写句子：花儿开了。", right: "鸟儿叫了。", wrongs: ["鸟儿在树上。"], analysis: "句式仿写未保持「主语+动词+了」结构。", kp: "句式仿写" },
    { text: "找出短文的中心句", right: "第一句", wrongs: ["最后一句"], analysis: "阅读理解中未抓住段落关键句。", kp: "阅读理解·找关键句" },
  ];
  const samples = subject === "math" ? mathSamples : chnSamples;

  const results: GradingResultItem[] = [];
  for (let i = 0; i < nQ; i++) {
    const s = samples[(seed + i * 7) % samples.length];
    const isCorrect = (seed + i * 13) % 10 < 6;
    const kp = matchKnowledgePoint(s.kp, subject, kps) ?? pool[(seed + i) % pool.length];
    results.push({
      questionId: `Q${String(i + 1).padStart(3, "0")}`,
      questionText: s.text,
      isCorrect,
      studentAnswer: isCorrect ? s.right : s.wrongs[(seed + i) % s.wrongs.length],
      correctAnswer: s.right,
      analysis: isCorrect ? "回答正确，步骤完整。" : s.analysis,
      matchedKnowledgePoint: kp ? { id: kp.id, name: kp.name, subject: kp.subject } : null,
      confidence: Math.round(82 + ((seed + i * 3) % 15)) / 100,
    });
  }
  const wrong = results.filter((r) => !r.isCorrect).length;
  return {
    results,
    overallComment:
      wrong === 0
        ? `共 ${results.length} 题全部正确，继续保持！（演示模型输出）`
        : `共 ${results.length} 题，错 ${wrong} 题，建议加强薄弱知识点练习。（演示模型输出，接入真实 VLM 后将基于照片实际批改）`,
  };
}

export async function runGrading(params: {
  settings: AISettings;
  imageDataUrl: string;
  imageMd5: string;
  subject: Subject;
  knowledgePoints: KnowledgePoint[];
}): Promise<{ results: GradingResultItem[]; overallComment: string }> {
  const { settings, imageDataUrl, imageMd5, subject, knowledgePoints } = params;

  if (settings.provider === "mock") {
    // 模拟异步识别延时，便于演示前端轮询
    await new Promise((r) => setTimeout(r, 2500));
    return mockGrade(imageMd5, subject, knowledgePoints);
  }

  const prompt = buildPrompt(subject, knowledgePoints);
  const raw = await chatCompletion(settings, visionMessage(prompt, imageDataUrl), {
    jsonMode: true,
  });
  const parsed = extractJSON<RawGradingOutput>(raw);
  return normalizeResults(parsed, subject, knowledgePoints);
}
