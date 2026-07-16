import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { createMockPrisma, type MockPrisma } from "../mocks/prisma";
import { __setTestPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

let mockPrisma: MockPrisma;

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    })
  ),
}));

function createRequest(body: object): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    __setTestPrisma(mockPrisma as unknown as import("@prisma/client").PrismaClient);
    vi.clearAllMocks();
  });

  afterEach(() => {
    __setTestPrisma(undefined);
  });

  it("账号密码正确时返回用户信息", async () => {
    const passwordHash = await bcrypt.hash("123456", 12);
    mockPrisma.teacher.findUnique = vi.fn().mockResolvedValue({
      id: "T_wang",
      schoolId: "SCH_001",
      name: "王校长",
      role: "principal",
      phone: null,
      email: null,
      gradeId: null,
      passwordHash,
      classAssignments: [],
    });
    mockPrisma.session.create = vi.fn().mockResolvedValue({ id: "sess_1" });
    mockPrisma.rateLimit.findUnique = vi.fn().mockResolvedValue(null);
    mockPrisma.rateLimit.upsert = vi.fn().mockResolvedValue({});
    mockPrisma.auditLog.create = vi.fn().mockResolvedValue({});

    const res = await POST(createRequest({ teacherId: "T_wang", password: "123456" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user.id).toBe("T_wang");
  });

  it("密码错误时返回 401", async () => {
    const passwordHash = await bcrypt.hash("123456", 12);
    mockPrisma.teacher.findUnique = vi.fn().mockResolvedValue({
      id: "T_wang",
      schoolId: "SCH_001",
      name: "王校长",
      role: "principal",
      phone: null,
      email: null,
      gradeId: null,
      passwordHash,
      classAssignments: [],
    });
    mockPrisma.rateLimit.findUnique = vi.fn().mockResolvedValue(null);
    mockPrisma.rateLimit.upsert = vi.fn().mockResolvedValue({});
    mockPrisma.rateLimit.update = vi.fn().mockResolvedValue({});
    mockPrisma.auditLog.create = vi.fn().mockResolvedValue({});

    const res = await POST(createRequest({ teacherId: "T_wang", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("缺少参数时返回 400", async () => {
    const res = await POST(createRequest({ teacherId: "T_wang" }));
    expect(res.status).toBe(400);
  });
});
