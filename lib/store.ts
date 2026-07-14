import fs from "node:fs";
import path from "node:path";
import { buildSeed } from "./seed";
import type { DB } from "./types";

/**
 * 原型数据层：
 * - 本地开发：持久化到 .data/db.json（重启不丢数据）
 * - Vercel / 只读文件系统：内存存储（globalThis 缓存，冷启动后重置为种子数据）
 *
 * 生产版本将替换为 PostgreSQL + Redis（见 PRD 5.2）。
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

const canPersist = !process.env.VERCEL && !process.env.READONLY_FS;

const g = globalThis as unknown as { __tutoringDB?: DB };

function loadFromDisk(): DB | null {
  if (!canPersist) return null;
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as DB;
    }
  } catch {
    // 文件损坏则重建种子数据
  }
  return null;
}

export function getDB(): DB {
  if (!g.__tutoringDB) {
    g.__tutoringDB = loadFromDisk() ?? buildSeed();
  }
  return g.__tutoringDB;
}

export function saveDB(): void {
  if (!canPersist || !g.__tutoringDB) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(g.__tutoringDB));
  } catch {
    // 只读环境下静默降级为内存模式
  }
}

export function resetDB(): DB {
  g.__tutoringDB = buildSeed();
  saveDB();
  return g.__tutoringDB;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
