import fs from "node:fs";
import path from "node:path";

/**
 * 图片对象存储驱动（作业照片 / 校区 Logo）：
 * - blob：Vercel Blob（配置 BLOB_READ_WRITE_TOKEN 后自动启用，Vercel 上推荐）
 * - s3：任意 S3 兼容存储 —— 阿里云 OSS、MinIO、Supabase Storage 等（S3_* 环境变量）
 * - local：本地自建，文件写入 .data/uploads，经 /api/files/[key] 提供访问
 * - inline：base64 内联存入数据库文档（只读文件系统且无对象存储时的降级）
 *
 * 可通过 STORAGE_DRIVER 显式指定：blob | s3 | local | inline
 */

export type StorageDriverName = "blob" | "s3" | "local" | "inline";

const UPLOADS_DIR = path.join(process.cwd(), ".data", "uploads");

function s3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
  );
}

function canWriteLocalFS(): boolean {
  if (process.env.VERCEL || process.env.READONLY_FS) return false;
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function getStorageDriverName(): StorageDriverName {
  const driver = process.env.STORAGE_DRIVER as StorageDriverName | undefined;
  if (driver && ["blob", "s3", "local", "inline"].includes(driver)) return driver;
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (s3Configured()) return "s3";
  if (canWriteLocalFS()) return "local";
  return "inline";
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("无效的图片数据");
  const contentType = match[1];
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return { buffer: Buffer.from(match[2], "base64"), contentType, ext };
}

async function s3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * 保存图片，返回可供 <img> 使用的地址。
 * @param key 不含扩展名的对象键（如 tasks/abc123）
 * @param dataUrl base64 data URL
 */
export async function putImage(key: string, dataUrl: string): Promise<string> {
  const driver = getStorageDriverName();

  if (driver === "inline") return dataUrl;

  const { buffer, contentType, ext } = parseDataUrl(dataUrl);
  const fullKey = `${key}.${ext}`;

  if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    const g = globalThis as unknown as { __blobAccess?: "public" | "private" };
    const access = process.env.BLOB_ACCESS === "private" ? "private" : (g.__blobAccess ?? "public");
    try {
      const res = await put(fullKey, buffer, {
        access,
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      g.__blobAccess = access;
      // 私有桶的 blob.url 不可公开访问，经服务端代理读取
      if (access === "private") return `/api/files/${encodeURIComponent(fullKey)}`;
      return res.url;
    } catch (e) {
      // 桶为私有访问模式时，public 上传会报错 —— 自动降级为 private 并记住
      const msg = e instanceof Error ? e.message : String(e);
      if (access === "public" && /private/i.test(msg)) {
        await put(fullKey, buffer, {
          access: "private",
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        g.__blobAccess = "private";
        return `/api/files/${encodeURIComponent(fullKey)}`;
      }
      throw e;
    }
  }

  if (driver === "s3") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: fullKey,
        Body: buffer,
        ContentType: contentType,
      })
    );
    // 提供公开访问基址（如 OSS 自定义域名 / CDN）则直链，否则经服务端代理读取
    const publicBase = process.env.S3_PUBLIC_URL;
    if (publicBase) return `${publicBase.replace(/\/+$/, "")}/${fullKey}`;
    return `/api/files/${encodeURIComponent(fullKey)}`;
  }

  // local
  const safeName = fullKey.replace(/[^a-zA-Z0-9._-]/g, "_");
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
  return `/api/files/${encodeURIComponent(safeName)}`;
}

/** 读取图片（供 /api/files/[key] 代理本地文件或私有 S3 桶） */
export async function readImage(
  key: string
): Promise<{ body: Uint8Array; contentType: string } | null> {
  const contentType = key.endsWith(".png")
    ? "image/png"
    : key.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  const safeName = key.replace(/[^a-zA-Z0-9._/-]/g, "_");
  const localPath = path.join(UPLOADS_DIR, safeName.replace(/\//g, "_"));
  if (fs.existsSync(localPath)) {
    return { body: fs.readFileSync(localPath), contentType };
  }

  // 私有 Vercel Blob 桶：经服务端读取后代理返回
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get } = await import("@vercel/blob");
      const result = await get(key, { access: "private" });
      if (result) {
        const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
        return { body: bytes, contentType: result.blob.contentType || contentType };
      }
    } catch {
      // 继续尝试其他来源
    }
  }

  if (s3Configured()) {
    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await s3Client();
      const res = await client.send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key })
      );
      const body = await res.Body?.transformToByteArray();
      if (body) return { body, contentType: res.ContentType || contentType };
    } catch {
      return null;
    }
  }
  return null;
}
