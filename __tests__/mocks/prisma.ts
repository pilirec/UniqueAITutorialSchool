import { vi } from "vitest";

function mockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
}

/**
 * 可注入的 Prisma mock，测试中通过 vi.mock("@/lib/prisma", () => ({ prisma: createMockPrisma() })) 使用。
 */
export function createMockPrisma() {
  return {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fnOrArray: unknown) => {
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray.map((p) => (typeof p === "function" ? p() : p)));
      }
      return (fnOrArray as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
    }),
    school: mockModel(),
    grade: mockModel(),
    classRoom: mockModel(),
    teacher: mockModel(),
    teacherClassAssignment: mockModel(),
    student: mockModel(),
    knowledgePoint: mockModel(),
    gradingTask: mockModel(),
    gradingResult: mockModel(),
    behaviorRecord: mockModel(),
    session: mockModel(),
    aISetting: mockModel(),
    auditLog: mockModel(),
    jobQueue: mockModel(),
    rateLimit: mockModel(),
  };
}

const mockTx = createMockPrisma();

export type MockPrisma = ReturnType<typeof createMockPrisma>;
