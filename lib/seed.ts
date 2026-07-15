import type {
  DB,
  Grade,
  ClassRoom,
  Teacher,
  Student,
  KnowledgePoint,
  GradingTask,
  BehaviorRecord,
  GradingResultItem,
} from "./types";

const AVATAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function daysAgo(n: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
  return d.toISOString();
}

export function buildSeed(): DB {
  const schoolId = "SCH_001";

  const grades: Grade[] = [
    { id: "G1", schoolId, name: "一年级", sortOrder: 1 },
    { id: "G2", schoolId, name: "二年级", sortOrder: 2 },
    { id: "G3", schoolId, name: "三年级", sortOrder: 3 },
  ];

  const classes: ClassRoom[] = [
    { id: "C11", schoolId, gradeId: "G1", name: "一(1)班", headTeacherId: "T_chen" },
    { id: "C21", schoolId, gradeId: "G2", name: "二(1)班", headTeacherId: "T_zhang" },
    { id: "C22", schoolId, gradeId: "G2", name: "二(2)班", headTeacherId: "T_liu" },
    { id: "C31", schoolId, gradeId: "G3", name: "三(1)班", headTeacherId: "T_zhao" },
  ];

  const teachers: Teacher[] = [
    { id: "T_wang", schoolId, name: "王校长", role: "principal", phone: "13800000001", classIds: [] },
    { id: "T_li", schoolId, name: "李主任", role: "grade_leader", phone: "13800000002", gradeId: "G2", classIds: ["C21", "C22"] },
    { id: "T_zhang", schoolId, name: "张老师", role: "teacher", phone: "13800000003", classIds: ["C21"] },
    { id: "T_liu", schoolId, name: "刘老师", role: "teacher", phone: "13800000004", classIds: ["C22"] },
    { id: "T_chen", schoolId, name: "陈老师", role: "teacher", phone: "13800000005", classIds: ["C11"] },
    { id: "T_zhao", schoolId, name: "赵老师", role: "teacher", phone: "13800000006", classIds: ["C31"] },
  ];

  const studentNames: Array<[string, "男" | "女", string]> = [
    ["刘一诺", "女", "C21"], ["陈宇轩", "男", "C21"], ["王梓涵", "女", "C21"],
    ["李昊然", "男", "C21"], ["张欣怡", "女", "C21"], ["杨浩宇", "男", "C21"],
    ["黄思远", "男", "C22"], ["周雨桐", "女", "C22"], ["吴子墨", "男", "C22"],
    ["徐若汐", "女", "C22"], ["孙铭泽", "男", "C22"], ["马诗涵", "女", "C22"],
    ["朱俊杰", "男", "C11"], ["胡可欣", "女", "C11"], ["郭一鸣", "男", "C11"],
    ["林芷萱", "女", "C11"], ["何梓豪", "男", "C11"],
    ["高晨曦", "女", "C31"], ["罗天佑", "男", "C31"], ["郑语嫣", "女", "C31"],
    ["梁子睿", "男", "C31"], ["宋佳琪", "女", "C31"],
  ];

  const students: Student[] = studentNames.map(([name, gender, classId], i) => ({
    id: `S${String(i + 1).padStart(3, "0")}`,
    schoolId,
    classId,
    name,
    gender,
    age: classId === "C11" ? 7 : classId.startsWith("C2") ? 8 : 9,
    parentPhone: `139${String(10000000 + i * 137).slice(0, 8)}`,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    createdAt: daysAgo(30 - i),
  }));

  const kpDefs: Array<[string, "math" | "chinese", string]> = [
    ["KP_MATH_2_001", "math", "100以内加减法"],
    ["KP_MATH_2_002", "math", "进位加法"],
    ["KP_MATH_2_003", "math", "退位减法"],
    ["KP_MATH_2_012", "math", "两位数乘法"],
    ["KP_MATH_2_015", "math", "乘法口诀"],
    ["KP_MATH_2_020", "math", "有余数的除法"],
    ["KP_MATH_2_025", "math", "长度单位换算"],
    ["KP_MATH_2_030", "math", "时间的认识"],
    ["KP_MATH_2_035", "math", "应用题·倍数关系"],
    ["KP_MATH_2_040", "math", "图形的认识"],
    ["KP_CHN_2_001", "chinese", "拼音·平翘舌"],
    ["KP_CHN_2_005", "chinese", "形近字辨析"],
    ["KP_CHN_2_010", "chinese", "多音字"],
    ["KP_CHN_2_015", "chinese", "量词搭配"],
    ["KP_CHN_2_020", "chinese", "句式仿写"],
    ["KP_CHN_2_025", "chinese", "阅读理解·找关键句"],
    ["KP_CHN_2_030", "chinese", "看图写话"],
  ];

  const knowledgePoints: KnowledgePoint[] = kpDefs.map(([id, subject, name]) => ({
    id,
    schoolId,
    subject,
    name,
    status: "approved",
  }));
  knowledgePoints.push({
    id: "KP_PENDING_001",
    schoolId,
    subject: "math",
    name: "混合运算的运算顺序",
    status: "pending",
    proposedBy: "T_zhang",
  });

  // —— 预置批改任务（让看板有数据）——
  const mkResult = (
    q: string,
    ok: boolean,
    ans: string,
    correct: string,
    analysis: string,
    kpId: string,
    conf: number
  ): GradingResultItem => {
    const kp = knowledgePoints.find((k) => k.id === kpId)!;
    return {
      questionId: q,
      isCorrect: ok,
      studentAnswer: ans,
      correctAnswer: correct,
      analysis,
      matchedKnowledgePoint: { id: kp.id, name: kp.name, subject: kp.subject },
      confidence: conf,
    };
  };

  const gradingTasks: GradingTask[] = [];
  const seededSets: Array<{
    studentId: string;
    teacherId: string;
    classId: string;
    day: number;
    results: GradingResultItem[];
  }> = [
    {
      studentId: "S002", teacherId: "T_zhang", classId: "C21", day: 1,
      results: [
        mkResult("Q001", false, "28", "32", "计算 16×2 时进位错误，个位 6×2=12 应向十位进 1。", "KP_MATH_2_012", 0.91),
        mkResult("Q002", true, "45", "45", "计算正确，步骤完整。", "KP_MATH_2_001", 0.97),
        mkResult("Q003", false, "7余2", "7余3", "余数计算错误，52-49=3 而不是 2。", "KP_MATH_2_020", 0.88),
      ],
    },
    {
      studentId: "S001", teacherId: "T_zhang", classId: "C21", day: 1,
      results: [
        mkResult("Q001", true, "32", "32", "两位数乘法掌握良好。", "KP_MATH_2_012", 0.95),
        mkResult("Q002", true, "45", "45", "计算正确。", "KP_MATH_2_001", 0.98),
        mkResult("Q003", true, "7余3", "7余3", "余数处理正确。", "KP_MATH_2_020", 0.93),
      ],
    },
    {
      studentId: "S004", teacherId: "T_zhang", classId: "C21", day: 2,
      results: [
        mkResult("Q001", false, "51", "61", "退位减法出错：73-12 不需要退位，学生误多减了 10。", "KP_MATH_2_003", 0.9),
        mkResult("Q002", false, "3时", "3时30分", "对钟面半点的读法不熟练。", "KP_MATH_2_030", 0.85),
        mkResult("Q003", true, "24", "24", "乘法口诀运用正确。", "KP_MATH_2_015", 0.96),
      ],
    },
    {
      studentId: "S008", teacherId: "T_liu", classId: "C22", day: 2,
      results: [
        mkResult("Q001", false, "帜", "识", "形近字混淆：「认识」的「识」误写为「帜」。", "KP_CHN_2_005", 0.89),
        mkResult("Q002", true, "一条鱼", "一条鱼", "量词使用正确。", "KP_CHN_2_015", 0.94),
      ],
    },
    {
      studentId: "S009", teacherId: "T_liu", classId: "C22", day: 3,
      results: [
        mkResult("Q001", false, "36", "42", "应用题倍数关系理解偏差：应为 14×3 而非 12×3。", "KP_MATH_2_035", 0.83),
        mkResult("Q002", false, "29", "32", "两位数乘法竖式对位错误。", "KP_MATH_2_012", 0.87),
      ],
    },
    {
      studentId: "S003", teacherId: "T_zhang", classId: "C21", day: 3,
      results: [
        mkResult("Q001", false, "30", "32", "两位数乘法漏加进位。", "KP_MATH_2_012", 0.9),
        mkResult("Q002", true, "58", "58", "进位加法正确。", "KP_MATH_2_002", 0.95),
      ],
    },
    {
      studentId: "S005", teacherId: "T_zhang", classId: "C21", day: 4,
      results: [
        mkResult("Q001", true, "32", "32", "计算正确。", "KP_MATH_2_012", 0.96),
        mkResult("Q002", false, "100厘米", "1米", "单位换算方向正确但未按题目要求写成「米」。", "KP_MATH_2_025", 0.8),
      ],
    },
    {
      studentId: "S010", teacherId: "T_liu", classId: "C22", day: 4,
      results: [
        mkResult("Q001", true, "识", "识", "形近字辨析正确。", "KP_CHN_2_005", 0.93),
        mkResult("Q002", false, "他高兴地说话", "他高兴地说", "句式仿写基本正确，但多写了成分。", "KP_CHN_2_020", 0.78),
      ],
    },
  ];

  seededSets.forEach((s, i) => {
    const wrong = s.results.filter((r) => !r.isCorrect).length;
    gradingTasks.push({
      id: `TASK_SEED_${String(i + 1).padStart(3, "0")}`,
      schoolId,
      teacherId: s.teacherId,
      studentId: s.studentId,
      classId: s.classId,
      subject: s.results[0].matchedKnowledgePoint!.subject,
      imageMd5: `seedmd5${i}`,
      imageDataUrl: "",
      imageName: "作业照片（演示数据）.jpg",
      status: "success",
      provider: "mock",
      model: "demo-vision",
      results: s.results,
      overallComment:
        wrong === 0
          ? "本次作业全部正确，继续保持！"
          : `共 ${s.results.length} 题，错 ${wrong} 题，建议针对薄弱知识点加强练习。`,
      createdAt: daysAgo(s.day, 15),
      finishedAt: daysAgo(s.day, 16),
    });
  });

  const behaviorRecords: BehaviorRecord[] = [
    {
      id: "BR_001", schoolId, studentId: "S002", teacherId: "T_zhang", type: "behavior",
      rawText: "今天上课主动举手回答问题3次，但是午休时和同桌讲话被提醒了两次。",
      tags: [
        { label: "课堂积极", sentiment: "positive" },
        { label: "主动发言", sentiment: "positive" },
        { label: "午休纪律", sentiment: "negative" },
      ],
      summary: "课堂参与度高，主动发言积极；午休纪律需引导，建议安排靠前座位并及时正向激励。",
      provider: "mock",
      createdAt: daysAgo(1, 17),
    },
    {
      id: "BR_002", schoolId, studentId: "S001", teacherId: "T_zhang", type: "behavior",
      rawText: "帮助同学讲解数学题，很有耐心，作业完成质量高。",
      tags: [
        { label: "乐于助人", sentiment: "positive" },
        { label: "作业认真", sentiment: "positive" },
      ],
      summary: "学习习惯优秀，具备同伴辅导能力，可担任小组长发挥示范作用。",
      provider: "mock",
      createdAt: daysAgo(2, 17),
    },
    {
      id: "BR_003", schoolId, studentId: "S004", teacherId: "T_zhang", type: "homework",
      rawText: "数学作业连续两天出现计算粗心，订正态度还不错。",
      tags: [
        { label: "计算粗心", sentiment: "negative" },
        { label: "订正认真", sentiment: "positive" },
      ],
      summary: "计算准确率待提升，建议每日 5 道口算强化训练；订正态度积极是好信号。",
      provider: "mock",
      createdAt: daysAgo(2, 18),
    },
    {
      id: "BR_004", schoolId, studentId: "S008", teacherId: "T_liu", type: "behavior",
      rawText: "语文课朗读声音响亮，但写字姿势需要纠正。",
      tags: [
        { label: "朗读出色", sentiment: "positive" },
        { label: "写字姿势", sentiment: "negative" },
      ],
      summary: "朗读表现突出，可参加朗读展示；需持续提醒握笔与坐姿。",
      provider: "mock",
      createdAt: daysAgo(3, 17),
    },
  ];

  return {
    school: { id: schoolId, name: "启明智慧托辅中心" },
    grades,
    classes,
    teachers,
    students,
    knowledgePoints,
    gradingTasks,
    behaviorRecords,
    aiSettings: {
      provider: process.env.AI_PROVIDER || "mock",
      model: process.env.AI_MODEL || "",
      apiKey: process.env.AI_API_KEY || "",
      baseUrl: process.env.AI_BASE_URL || "",
    },
  };
}
