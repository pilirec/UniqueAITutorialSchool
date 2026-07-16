import { z } from "zod";

export const SubjectEnum = z.enum(["math", "chinese"]);
export const RoleEnum = z.enum(["principal", "grade_leader", "teacher"]);
export const RecordTypeEnum = z.enum(["behavior", "homework", "note"]);

export const loginSchema = z.object({
  teacherId: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const orgCreateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("grade"),
    name: z.string().min(1).max(50),
  }),
  z.object({
    type: z.literal("class"),
    name: z.string().min(1).max(50),
    gradeId: z.string().min(1).max(32),
    headTeacherId: z.string().max(32).optional(),
  }),
]);

export const orgDeleteSchema = z.object({
  type: z.enum(["grade", "class"]),
  id: z.string().min(1).max(32),
});

export const studentInputSchema = z.object({
  name: z.string().min(1).max(50),
  gender: z.enum(["男", "女"]).optional(),
  age: z.union([z.number().int().min(3).max(30), z.string()]).optional(),
  parentPhone: z.string().max(20).optional(),
  classId: z.string().min(1).max(32),
});

export const studentCreateSchema = z.union([
  studentInputSchema,
  z.object({ students: z.array(studentInputSchema).min(1).max(200) }),
]);

export const behaviorRecordSchema = z.object({
  text: z.string().min(1).max(2000),
  type: RecordTypeEnum.optional(),
});

export const knowledgePointSchema = z.object({
  name: z.string().min(1).max(100),
  subject: SubjectEnum,
});

export const knowledgePointReviewSchema = z.object({
  id: z.string().min(1).max(32),
  action: z.enum(["approve", "reject"]),
});

export const teacherCreateSchema = z.object({
  name: z.string().min(1).max(50),
  role: RoleEnum,
  phone: z.string().max(20).optional(),
  gradeId: z.string().max(32).optional(),
  classIds: z.array(z.string().min(1).max(32)).max(50).optional(),
});

export const gradingTaskCreateSchema = z.object({
  imageDataUrl: z.string().max(10_000_000), // 服务端二次校验 MIME 与大小
  imageName: z.string().max(255).optional(),
  studentId: z.string().max(32).optional(),
  subject: SubjectEnum,
});

export const schoolSettingsSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  logoDataUrl: z.string().max(5_000_000).optional(),
});

export const aiSettingsSchema = z.object({
  provider: z.string().min(1).max(32),
  model: z.string().max(128).optional(),
  apiKey: z.string().max(512).optional(),
  baseUrl: z.string().max(512).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type OrgCreateInput = z.infer<typeof orgCreateSchema>;
export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type BehaviorRecordInput = z.infer<typeof behaviorRecordSchema>;
export type KnowledgePointInput = z.infer<typeof knowledgePointSchema>;
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
export type GradingTaskCreateInput = z.infer<typeof gradingTaskCreateSchema>;
export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;
export type AISettingsInput = z.infer<typeof aiSettingsSchema>;

export async function validateJson<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: "请求体不是有效 JSON" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message || "参数校验失败" };
  }
  return { ok: true, data: parsed.data };
}

/** 检验 data URL 是否为允许的图片类型。 */
export function validateImageDataUrl(dataUrl: string): {
  ok: boolean;
  contentType?: string;
  sizeBytes?: number;
  error?: string;
} {
  const match = dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,([\s\S]*)$/i);
  if (!match) {
    return { ok: false, error: "图片格式不支持，请传输 jpeg/png/webp" };
  }
  const contentType = match[1];
  const base64 = match[3];
  const sizeBytes = Buffer.byteLength(base64, "base64");
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (sizeBytes > maxSize) {
    return { ok: false, error: "图片不能超过 5MB" };
  }
  return { ok: true, contentType, sizeBytes };
}
