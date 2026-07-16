import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  __tutoringPrisma?: PrismaClient;
  __tutoringTestPrisma?: PrismaClient;
};

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    throw new Error("缺少数据库连接字符串，请设置 DATABASE_URL / POSTGRES_URL");
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.__tutoringTestPrisma) {
    return globalForPrisma.__tutoringTestPrisma;
  }
  if (!globalForPrisma.__tutoringPrisma) {
    globalForPrisma.__tutoringPrisma = createPrismaClient();
  }
  return globalForPrisma.__tutoringPrisma;
}

/** 仅测试使用：注入 mock PrismaClient。 */
export function __setTestPrisma(client: PrismaClient | undefined): void {
  globalForPrisma.__tutoringTestPrisma = client;
}

/**
 * 懒加载 PrismaClient：在第一次访问时才创建实例，避免 Next.js build 时因缺少环境变量而报错。
 * 运行时所有代码都通过 prisma.xxx 访问，Proxy 会转发到真实客户端。
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as any)[prop];
  },
});
