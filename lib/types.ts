export type Role = "principal" | "grade_leader" | "teacher";

export interface School {
  id: string;
  name: string;
}

export interface Grade {
  id: string;
  schoolId: string;
  name: string;
  sortOrder: number;
}

export interface ClassRoom {
  id: string;
  schoolId: string;
  gradeId: string;
  name: string;
  headTeacherId?: string;
}

export interface Teacher {
  id: string;
  schoolId: string;
  name: string;
  role: Role;
  phone?: string;
  /** grade_leader 管辖的年级 */
  gradeId?: string;
  /** teacher 任教的班级 */
  classIds: string[];
}

export interface Student {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  gender: "男" | "女";
  age: number;
  parentPhone?: string;
  avatarColor: string;
  createdAt: string;
}

export type Subject = "math" | "chinese";

export interface KnowledgePoint {
  id: string;
  schoolId: string;
  subject: Subject;
  name: string;
  status: "approved" | "pending";
  proposedBy?: string;
}

export interface GradingResultItem {
  questionId: string;
  questionText?: string;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer?: string;
  analysis: string;
  matchedKnowledgePoint: {
    id: string;
    name: string;
    subject: Subject;
  } | null;
  confidence: number;
}

export type TaskStatus = "processing" | "success" | "failed";

export interface GradingTask {
  id: string;
  schoolId: string;
  teacherId: string;
  studentId?: string;
  classId?: string;
  subject: Subject;
  imageMd5: string;
  imageDataUrl: string;
  imageName?: string;
  status: TaskStatus;
  provider: string;
  model: string;
  error?: string;
  results: GradingResultItem[];
  overallComment?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface BehaviorTag {
  label: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface BehaviorRecord {
  id: string;
  schoolId: string;
  studentId: string;
  teacherId: string;
  type: "behavior" | "homework" | "note";
  rawText: string;
  tags: BehaviorTag[];
  summary: string;
  provider?: string;
  createdAt: string;
}

export interface AISettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface DB {
  school: School;
  grades: Grade[];
  classes: ClassRoom[];
  teachers: Teacher[];
  students: Student[];
  knowledgePoints: KnowledgePoint[];
  gradingTasks: GradingTask[];
  behaviorRecords: BehaviorRecord[];
  aiSettings: AISettings;
}
