# 测试指南

## 单元测试

```bash
# 运行所有单元测试
npm run test

# 监听模式
npm run test:watch

# 带覆盖率
npm run test -- --coverage
```

测试位于 `__tests__/unit/`，使用 Vitest + jsdom。

### 模拟 Prisma

`__tests__/mocks/prisma.ts` 提供 `createMockPrisma()`，测试中通过 `__setTestPrisma(mock)` 注入 mock：

```ts
import { createMockPrisma } from "../mocks/prisma";
import { __setTestPrisma } from "@/lib/prisma";

beforeEach(() => {
  const mock = createMockPrisma();
  __setTestPrisma(mock as unknown as PrismaClient);
});

afterEach(() => {
  __setTestPrisma(undefined);
});
```

## E2E 测试

```bash
# 运行 E2E
npm run test:e2e

# UI 模式
npm run test:e2e:ui
```

E2E 使用 Playwright，测试位于 `e2e/` 。
`playwright.config.ts` 会自动起 `npm run dev` 作为 webServer。

> 本地需要先配置数据库并执行 `npm run db:seed`，否则 E2E 登录会失败。

## 建议补充的测试

- RBAC：不同角色访问越权数据时应返回 403
- 批改流：上传图片 → 创建 task → 队列执行 → 轮询返回结果
- 审计日志：敏感操作后 `AuditLog` 表是否写入
