import { vi } from "vitest";

// 为 jsdom 补丁 fetch AbortSignal.timeout
if (typeof AbortSignal !== "undefined" && !AbortSignal.timeout) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (AbortSignal as any).timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// 模拟 crypto.randomBytes 以保证 Session token 可预测
const originalRandomBytes = vi.fn((size: number) => {
  return Buffer.alloc(size, 0xab);
});
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomBytes: originalRandomBytes,
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
    return arr;
  },
});

process.env.ENCRYPTION_KEY = "test-encryption-key-32bytes-long!";
