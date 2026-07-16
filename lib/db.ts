import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import type {
  School,
  Grade,
  ClassRoom,
  Teacher,
  Student,
  KnowledgePoint,
  GradingTask,
  GradingResultItem,
  BehaviorRecord,
  BehaviorTag,
  AISettings,
  Subject,
  TaskStatus,
} from "./types";

function nullToUndefined<T>(v: T | null): T | undefined {
  return v === null ? undefined : v;
}

export function mapSchool(s: { id: string; name: string; logoSrc: string }): School {
  return { id: s.id, name: s.name, logoSrc: s.logoSrc };
}

export function mapGrade(g: { id: string; schoolId: string; name: string; sortOrder: number }): Grade {
  return { id: g.id, schoolId: g.schoolId, name: g.name, sortOrder: g.sortOrder };
}

export function mapClassRoom(c: {
  id: string;
  schoolId: string;
  gradeId: string;
  name: string;
  headTeacherId: string | null;
}): ClassRoom {
  return {
    id: c.id,
    schoolId: c.schoolId,
    gradeId: c.gradeId,
    name: c.name,
    headTeacherId: nullToUndefined(c.headTeacherId),
  };
}

export function mapTeacher(t: {
  id: string;
  schoolId: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  gradeId: string | null;
  classAssignments?: { classId: string }[];
}): Teacher {
  return {
    id: t.id,
    schoolId: t.schoolId,
    name: t.name,
    role: t.role as Teacher["role"],
    phone: nullToUndefined(t.phone),
    email: nullToUndefined(t.email),
    gradeId: nullToUndefined(t.gradeId),
    classIds: t.classAssignments?.map((ca) => ca.classId) ?? [],
  };
}

export function mapStudent(s: {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  gender: string;
  age: number;
  parentPhone: string | null;
  avatarColor: string;
  createdAt: Date;
}): Student {
  return {
    id: s.id,
    schoolId: s.schoolId,
    classId: s.classId,
    name: s.name,
    gender: s.gender as Student["gender"],
    age: s.age,
    parentPhone: nullToUndefined(s.parentPhone),
    avatarColor: s.avatarColor,
    createdAt: s.createdAt.toISOString(),
  };
}

export function mapKnowledgePoint(k: {
  id: string;
  schoolId: string;
  subject: string;
  name: string;
  status: string;
  proposedBy: string | null;
}): KnowledgePoint {
  return {
    id: k.id,
    schoolId: k.schoolId,
    subject: k.subject as Subject,
    name: k.name,
    status: k.status as KnowledgePoint["status"],
    proposedBy: nullToUndefined(k.proposedBy),
  };
}

export function mapGradingResultItem(r: {
  id?: string;
  questionId: string;
  questionText: string | null;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer: string | null;
  analysis: string;
  knowledgePointId: string | null;
  knowledgePointName: string | null;
  knowledgePointSubject: string | null;
  confidence: number;
}): GradingResultItem {
  return {
    questionId: r.questionId,
    questionText: nullToUndefined(r.questionText),
    isCorrect: r.isCorrect,
    studentAnswer: r.studentAnswer,
    correctAnswer: nullToUndefined(r.correctAnswer),
    analysis: r.analysis,
    matchedKnowledgePoint:
      r.knowledgePointId && r.knowledgePointName
        ? {
            id: r.knowledgePointId,
            name: r.knowledgePointName,
            subject: (r.knowledgePointSubject ?? "math") as Subject,
          }
        : null,
    confidence: r.confidence,
  };
}

export function mapGradingTask(t: {
  id: string;
  schoolId: string;
  teacherId: string;
  studentId: string | null;
  classId: string | null;
  subject: string;
  imageMd5: string;
  imageSrc: string;
  imageName: string | null;
  status: string;
  provider: string;
  model: string;
  error: string | null;
  overallComment: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  results: Array<{
    id?: string;
    questionId: string;
    questionText: string | null;
    isCorrect: boolean;
    studentAnswer: string;
    correctAnswer: string | null;
    analysis: string;
    knowledgePointId: string | null;
    knowledgePointName: string | null;
    knowledgePointSubject: string | null;
    confidence: number;
  }>;
}): GradingTask {
  return {
    id: t.id,
    schoolId: t.schoolId,
    teacherId: t.teacherId,
    studentId: nullToUndefined(t.studentId),
    classId: nullToUndefined(t.classId),
    subject: t.subject as Subject,
    imageMd5: t.imageMd5,
    imageSrc: t.imageSrc,
    imageName: nullToUndefined(t.imageName),
    status: t.status as TaskStatus,
    provider: t.provider,
    model: t.model,
    error: nullToUndefined(t.error),
    results: t.results.map(mapGradingResultItem),
    overallComment: nullToUndefined(t.overallComment),
    createdAt: t.createdAt.toISOString(),
    finishedAt: nullToUndefined(t.finishedAt)?.toISOString(),
  };
}

export function mapBehaviorRecord(r: {
  id: string;
  schoolId: string;
  studentId: string;
  teacherId: string;
  type: string;
  rawText: string;
  tags: unknown;
  summary: string;
  provider: string | null;
  createdAt: Date;
}): BehaviorRecord {
  return {
    id: r.id,
    schoolId: r.schoolId,
    studentId: r.studentId,
    teacherId: r.teacherId,
    type: r.type as BehaviorRecord["type"],
    rawText: r.rawText,
    tags: (r.tags as BehaviorTag[]) ?? [],
    summary: r.summary,
    provider: nullToUndefined(r.provider),
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getAISettings(): Promise<AISettings> {
  const setting = await prisma.aISetting.findFirst();
  if (!setting) {
    return {
      provider: process.env.AI_PROVIDER || "mock",
      model: process.env.AI_MODEL || "",
      apiKey: process.env.AI_API_KEY || "",
      baseUrl: process.env.AI_BASE_URL || "",
    };
  }
  return {
    provider: setting.provider,
    model: setting.model,
    apiKey: decrypt(setting.apiKey),
    baseUrl: setting.baseUrl,
  };
}

export async function getSchool(): Promise<School> {
  const school = await prisma.school.findFirst();
  if (!school) throw new Error("校区数据未初始化");
  return mapSchool(school);
}

export async function getTeachers(): Promise<Teacher[]> {
  const teachers = await prisma.teacher.findMany({
    include: { classAssignments: { select: { classId: true } } },
    orderBy: { createdAt: "asc" },
  });
  return teachers.map(mapTeacher);
}

export async function getStudents(where?: { classId?: { in: string[] }; deletedAt?: null }): Promise<Student[]> {
  const students = await prisma.student.findMany({
    where: { ...where, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return students.map(mapStudent);
}

export async function getClasses(): Promise<ClassRoom[]> {
  const classes = await prisma.classRoom.findMany({ orderBy: { createdAt: "asc" } });
  return classes.map(mapClassRoom);
}

export async function getGrades(): Promise<Grade[]> {
  const grades = await prisma.grade.findMany({ orderBy: { sortOrder: "asc" } });
  return grades.map(mapGrade);
}

export async function getKnowledgePoints(): Promise<KnowledgePoint[]> {
  const kps = await prisma.knowledgePoint.findMany({ orderBy: { createdAt: "asc" } });
  return kps.map(mapKnowledgePoint);
}

export async function getGradingTasks(where?: {
  classId?: { in: string[] };
  teacherId?: string;
}): Promise<GradingTask[]> {
  const tasks = await prisma.gradingTask.findMany({
    where,
    include: { results: true },
    orderBy: { createdAt: "desc" },
  });
  return tasks.map(mapGradingTask);
}
