import { prisma } from "./prisma";
import { mapGradingTask } from "./db";
import type { GradingTask } from "./types";

export interface KPStat {
  kpId: string;
  kpName: string;
  subject: string;
  total: number;
  wrong: number;
  wrongRate: number;
  mastery: number; // 0-100
}

/** 按知识点聚合批改结果（可按学生或班级过滤） */
export function aggregateKPStats(tasks: GradingTask[]): KPStat[] {
  const map = new Map<string, KPStat>();
  for (const task of tasks) {
    if (task.status !== "success") continue;
    for (const r of task.results) {
      if (!r.matchedKnowledgePoint) continue;
      const key = r.matchedKnowledgePoint.id;
      let stat = map.get(key);
      if (!stat) {
        stat = {
          kpId: key,
          kpName: r.matchedKnowledgePoint.name,
          subject: r.matchedKnowledgePoint.subject,
          total: 0,
          wrong: 0,
          wrongRate: 0,
          mastery: 0,
        };
        map.set(key, stat);
      }
      stat.total += 1;
      if (!r.isCorrect) stat.wrong += 1;
    }
  }
  for (const stat of map.values()) {
    stat.wrongRate = stat.total ? stat.wrong / stat.total : 0;
    stat.mastery = Math.round((1 - stat.wrongRate) * 100);
  }
  return [...map.values()].sort((a, b) => b.wrongRate - a.wrongRate || b.total - a.total);
}

export async function tasksForStudent(studentId: string): Promise<GradingTask[]> {
  const tasks = await prisma.gradingTask.findMany({
    where: { studentId },
    include: { results: true },
  });
  return tasks.map(mapGradingTask);
}

export async function tasksForClasses(classIds: Set<string>): Promise<GradingTask[]> {
  if (classIds.size === 0) return [];
  const tasks = await prisma.gradingTask.findMany({
    where: { classId: { in: [...classIds] } },
    include: { results: true },
  });
  return tasks.map(mapGradingTask);
}
