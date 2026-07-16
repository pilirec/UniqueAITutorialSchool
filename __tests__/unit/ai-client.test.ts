import { describe, it, expect, vi } from "vitest";
import { extractJSON, chatCompletion } from "@/lib/ai/client";
import type { AISettings } from "@/lib/types";

describe("ai/client", () => {
  describe("extractJSON", () => {
    it("直接解析 JSON", () => {
      const data = { a: 1 };
      expect(extractJSON<{ a: number }>(JSON.stringify(data))).toEqual(data);
    });

    it("容忍 markdown 代码块", () => {
      const raw = '```json\n{"a":1}\n```';
      expect(extractJSON<{ a: number }>(raw)).toEqual({ a: 1 });
    });

    it("从前后缀文本中提取 JSON", () => {
      const raw = '这是一些前缀 {"a":1} 后缀';
      expect(extractJSON<{ a: number }>(raw)).toEqual({ a: 1 });
    });

    it("无效 JSON 时报错", () => {
      expect(() => extractJSON("not json")).toThrow();
    });
  });

  describe("chatCompletion circuit breaker", () => {
    it("连续失败后断路器打开", async () => {
      const settings: AISettings = {
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("server error"),
      });

      // 洗掉可能的残留状态，确保测试独立
      for (let i = 0; i < 5; i++) {
        await expect(chatCompletion(settings, [{ role: "user", content: "hi" }])).rejects.toThrow();
      }

      // 第 6 次应该直接断路器快速失败
      await expect(chatCompletion(settings, [{ role: "user", content: "hi" }])).rejects.toThrow(
        "暂时不可用"
      );
    });
  });
});
