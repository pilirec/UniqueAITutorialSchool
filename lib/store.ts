import { buildSeed } from "./seed";
import { createPersistence, type Persistence } from "./persistence";
import type { DB } from "./types";

/**
 * 原型数据层（单文档模型 + 可插拔持久化驱动，见 lib/persistence.ts）：
 * - 配置了 POSTGRES_URL / DATABASE_URL（如 Vercel + Supabase 集成）→ Postgres
 * - 本地开发 → .data/db.json 文件
 * - 只读文件系统且无数据库 → 内存（冷启动重置为种子数据）
 */

const g = globalThis as unknown as {
  __tutoringDB?: DB;
  __tutoringPersistence?: Persistence;
  __tutoringLoad?: Promise<DB>;
};

export function getPersistence(): Persistence {
  if (!g.__tutoringPersistence) {
    g.__tutoringPersistence = createPersistence();
  }
  return g.__tutoringPersistence;
}

export async function getDB(): Promise<DB> {
  if (g.__tutoringDB) return g.__tutoringDB;
  if (!g.__tutoringLoad) {
    g.__tutoringLoad = (async () => {
      const persistence = getPersistence();
      let db: DB | null = null;
      try {
        db = await persistence.load();
      } catch (e) {
        console.error(`[store] ${persistence.name} 加载失败，使用种子数据`, e);
      }
      if (!db) {
        db = buildSeed();
        try {
          await persistence.save(db);
        } catch (e) {
          console.error(`[store] ${persistence.name} 初始化写入失败`, e);
        }
      }
      g.__tutoringDB = db;
      return db;
    })();
  }
  return g.__tutoringLoad;
}

export async function saveDB(): Promise<void> {
  if (!g.__tutoringDB) return;
  try {
    await getPersistence().save(g.__tutoringDB);
  } catch (e) {
    console.error("[store] 保存失败", e);
  }
}

export async function resetDB(): Promise<DB> {
  g.__tutoringDB = buildSeed();
  g.__tutoringLoad = Promise.resolve(g.__tutoringDB);
  await saveDB();
  return g.__tutoringDB;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
