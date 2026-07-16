import { prisma } from "./prisma";
import { getAISettings } from "./db";
import { runGrading } from "./ai/grading";
import { registerJobHandler, runPendingJobs } from "./queue";
import { logger } from "./logger";
import type { GradingResultItem, Subject } from "./types";

interface GradingJobPayload {
  taskId: string;
  imageDataUrl: string;
  imageMd5: string;
  subject: Subject;
}

registerJobHandler<GradingJobPayload>({
  queueName: "grading",
  maxAttempts: 3,
  async run(payload) {
    const { taskId, imageDataUrl, imageMd5, subject } = payload;
    const task = await prisma.gradingTask.findUnique({
      where: { id: taskId },
      include: { student: true },
    });
    if (!task) throw new Error("批改任务不存在");

    const settings = await getAISettings();
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: { schoolId: task.schoolId },
    });

    const { results, overallComment } = await runGrading({
      settings,
      imageDataUrl,
      imageMd5,
      subject,
      knowledgePoints: knowledgePoints.map((k) => ({
        id: k.id,
        schoolId: k.schoolId,
        subject: k.subject as Subject,
        name: k.name,
        status: k.status as "approved" | "pending",
        proposedBy: k.proposedBy ?? undefined,
      })),
    });

    await prisma.$transaction([
      prisma.gradingResult.deleteMany({ where: { taskId } }),
      prisma.gradingTask.update({
        where: { id: taskId },
        data: {
          status: "success",
          overallComment,
          finishedAt: new Date(),
        },
      }),
      prisma.gradingResult.createMany({
        data: results.map((r: GradingResultItem) => ({
          taskId,
          questionId: r.questionId,
          questionText: r.questionText ?? null,
          isCorrect: r.isCorrect,
          studentAnswer: r.studentAnswer,
          correctAnswer: r.correctAnswer ?? null,
          analysis: r.analysis,
          knowledgePointId: r.matchedKnowledgePoint?.id ?? null,
          knowledgePointName: r.matchedKnowledgePoint?.name ?? null,
          knowledgePointSubject: r.matchedKnowledgePoint?.subject ?? null,
          confidence: r.confidence,
        })),
      }),
    ]);

    logger.info({ taskId, resultCount: results.length }, "grading completed");
  },
});

export async function dispatchGradingJobs(): Promise<number> {
  return runPendingJobs("grading");
}
