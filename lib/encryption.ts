import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("生产环境必须设置 ENCRYPTION_KEY（32 字节以上随机字符串）");
    }
    // 开发 fallback：从固定字符串派生，仅本地调试使用
    return crypto.scryptSync("dev-only-encryption-key", "salt", KEY_LEN);
  }
  return crypto.scryptSync(raw, "salt", KEY_LEN);
}

/**
 * 加密敏感字符串（AES-256-GCM）。
 * 输出为 base64(iv + authTag + ciphertext)，可直接存入数据库。
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/** 解密由 encrypt 生成的字符串。 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  const combined = Buffer.from(ciphertext, "base64");
  if (combined.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error("密文格式异常");
  }
  const iv = combined.subarray(0, IV_LEN);
  const authTag = combined.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const encrypted = combined.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** 返回脱敏后的 Key，前端只展示该值。 */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}
