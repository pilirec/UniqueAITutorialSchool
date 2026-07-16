import { describe, it, expect } from "vitest";
import {
  loginSchema,
  teacherCreateSchema,
  validateImageDataUrl,
} from "@/lib/validation";

describe("validation", () => {
  describe("loginSchema", () => {
    it("接受合法账号密码", () => {
      const result = loginSchema.safeParse({
        teacherId: "T_wang",
        password: "123456",
      });
      expect(result.success).toBe(true);
    });

    it("拒绝空密码", () => {
      const result = loginSchema.safeParse({ teacherId: "T_wang", password: "" });
      expect(result.success).toBe(false);
    });

    it("拒绝超长密码", () => {
      const result = loginSchema.safeParse({
        teacherId: "T_wang",
        password: "a".repeat(200),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("teacherCreateSchema", () => {
    it("接受最小合法输入", () => {
      const result = teacherCreateSchema.safeParse({ name: "新老师", role: "teacher" });
      expect(result.success).toBe(true);
    });

    it("拒绝无效角色", () => {
      const result = teacherCreateSchema.safeParse({ name: "新老师", role: "admin" });
      expect(result.success).toBe(false);
    });
  });

  describe("validateImageDataUrl", () => {
    it("接受 jpeg base64", () => {
      const base64 = Buffer.from("fake-image").toString("base64");
      const result = validateImageDataUrl(`data:image/jpeg;base64,${base64}`);
      expect(result.ok).toBe(true);
      expect(result.contentType).toBe("image/jpeg");
    });

    it("拒绝非图片 MIME", () => {
      const result = validateImageDataUrl("data:text/plain;base64,abc");
      expect(result.ok).toBe(false);
    });

    it("拒绝超过 5MB 的图片", () => {
      const big = Buffer.alloc(6 * 1024 * 1024).toString("base64");
      const result = validateImageDataUrl(`data:image/png;base64,${big}`);
      expect(result.ok).toBe(false);
    });
  });
});
