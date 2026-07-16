import { describe, it, expect } from "vitest";
import { encrypt, decrypt, maskKey } from "@/lib/encryption";

describe("encryption", () => {
  it("应能加密并解密明文", () => {
    const plain = "sk-abc123456789";
    const cipher = encrypt(plain);
    expect(cipher).not.toBe(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("空字符串不应被加密", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });

  it("每次加密结果不同（GCM IV 随机）", () => {
    const plain = "same";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it("maskKey 应掩码中间字符", () => {
    expect(maskKey("sk-1234567890abcdef")).toBe("sk-1****cdef");
    expect(maskKey("short")).toBe("****");
    expect(maskKey("")).toBe("");
  });
});
