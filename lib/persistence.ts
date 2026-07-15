import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import type { DB } from "./types";

/**
 * 数据库持久化驱动：
 * - postgres：任意 PostgreSQL（Vercel 上推荐 Supabase 集成，注入 POSTGRES_URL / DATABASE_URL 后自动启用）
 * - file：本地自建，JSON 文件（.data/db.json）
 * - memory：只读文件系统且未配置数据库时的降级（冷启动重置为种子数据）
 *
 * 原型将整个业务状态作为单文档存储（Postgres 中为一行 jsonb），
 * 生产版将替换为规范化的关系表结构（见 PRD 5.2）。
 */

export interface Persistence {
  readonly name: "postgres" | "file" | "memory";
  load(): Promise<DB | null>;
  save(db: DB): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const STATE_ID = "main";

class MemoryPersistence implements Persistence {
  readonly name = "memory" as const;
  async load(): Promise<DB | null> {
    return null;
  }
  async save(): Promise<void> {}
}

class FilePersistence implements Persistence {
  readonly name = "file" as const;
  async load(): Promise<DB | null> {
    try {
      if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as DB;
      }
    } catch {
      // 文件损坏则重建种子数据
    }
    return null;
  }
  async save(db: DB): Promise<void> {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db));
  }
}

class PostgresPersistence implements Persistence {
  readonly name = "postgres" as const;
  private sql: postgres.Sql;
  private ready: Promise<void> | null = null;

  constructor(url: string) {
    // Supabase 事务池化(pgbouncer)不支持 prepared statements
    this.sql = postgres(url, { max: 1, prepare: false });
  }

  private ensureTable(): Promise<void> {
    if (!this.ready) {
      this.ready = this.sql`
        CREATE TABLE IF NOT EXISTS app_state (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`.then(() => undefined);
    }
    return this.ready;
  }

  async load(): Promise<DB | null> {
    await this.ensureTable();
    const rows = await this.sql<{ data: DB }[]>`
      SELECT data FROM app_state WHERE id = ${STATE_ID}`;
    return rows[0]?.data ?? null;
  }

  async save(db: DB): Promise<void> {
    await this.ensureTable();
    await this.sql`
      INSERT INTO app_state (id, data, updated_at)
      VALUES (${STATE_ID}, ${this.sql.json(db as unknown as postgres.JSONValue)}, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  }
}

function canWriteLocalFS(): boolean {
  if (process.env.VERCEL || process.env.READONLY_FS) return false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function createPersistence(): Persistence {
  const pgUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL;
  const driver = process.env.DB_DRIVER; // 可显式指定：postgres | file | memory
  if (driver === "memory") return new MemoryPersistence();
  if (driver === "file") return new FilePersistence();
  if (driver === "postgres" || (!driver && pgUrl)) {
    if (!pgUrl) throw new Error("DB_DRIVER=postgres 但未配置 DATABASE_URL / POSTGRES_URL");
    return new PostgresPersistence(pgUrl);
  }
  return canWriteLocalFS() ? new FilePersistence() : new MemoryPersistence();
}
