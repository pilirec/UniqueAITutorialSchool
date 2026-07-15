# UniqueAITutorialSchool

赛酷逻智慧托辅系统 —— AI 驱动的数字化辅导班校区教学管理平台。

## PRD 文档
- [内部智能化托辅班学管系统 PRD（V1.0）](docs/internal-smart-tutoring-prd-v1.md)

## 平台原型（V1.0）

本仓库包含一个可在 **本地机器** 与 **Vercel** 一键部署的全栈原型（Next.js 15 App Router + TypeScript + TailwindCSS + Recharts + TanStack Query），覆盖 PRD V1.0 的核心模块：

| 模块 | 功能 |
| --- | --- |
| 权限与组织（RBAC） | 校长 / 年级主任 / 老师三种演示角色一键切换，数据可见范围自动隔离 |
| 组织管理 | 年级 → 班级组织树增删、教师增删与角色 / 班级分配 |
| 学生建档 | 单个创建 + 批量导入（Excel 粘贴）、学生主页 Timeline、AI 行为分析（标签抽取 + 结构化摘要） |
| AI 拍照批改 | 拍照/上传 → 异步识别（前端轮询）→ 逐题判对错 + 错因分析 + 知识点归因，幂等控制（teacher_id + image_md5） |
| 学情看板 | 错题 Top 知识点（纵向）、学生掌握度排名与雷达图（横向） |
| 知识点字典 | 预置数学/语文知识点，教师提议 → 主任/教研审核入库 |
| 设置 | 校区名称 / Logo（默认「UNIQUE」）、AI 模型切换、存储与部署状态 |

系统名称固定为「赛酷逻智慧托辅系统」；校区名称与 Logo 可由校长角色在「设置」页修改（默认校区名「UNIQUE」）。

### 支持的 AI 提供商（不限于千问 VL / 豆包）

统一通过 OpenAI 兼容协议接入：

- **国产**：通义千问 Qwen-VL / Qwen3-VL、豆包 Doubao Seed Vision、智谱 GLM-4.5V、月之暗面 Kimi Vision、阶跃星辰 Step-1V、腾讯混元 Vision、DeepSeek（仅文本，用于行为分析）
- **海外**：OpenAI GPT-4o / GPT-4.1、Google Gemini 2.5、Anthropic Claude
- **聚合 / 自部署**：硅基流动 SiliconFlow、OpenRouter、自定义 OpenAI 兼容端点（Ollama、vLLM、LiteLLM 等）
- **内置演示模型**：零配置即可体验完整业务流程（返回确定性模拟结果）

API Key 在系统内「设置」页配置（仅校长角色），或通过环境变量预置：

```bash
AI_PROVIDER=qwen          # 提供商 id：mock/qwen/doubao/glm/moonshot/stepfun/hunyuan/deepseek/openai/gemini/anthropic/siliconflow/openrouter/custom
AI_MODEL=qwen3-vl-plus    # 模型名
AI_API_KEY=sk-...         # API Key
AI_BASE_URL=              # 仅 custom 需要
```

### 数据库与对象存储（可插拔驱动）

按环境变量自动选择，本地自建与云端托管均可：

| 层 | 驱动 | 启用条件 | 说明 |
| --- | --- | --- | --- |
| 数据库 | `postgres` | 配置 `DATABASE_URL` / `POSTGRES_URL`（Vercel 上安装 **Supabase 集成**即自动注入） | 状态存为一行 jsonb（表 `app_state`，自动建表） |
| 数据库 | `file` | 本地可写文件系统（默认） | `.data/db.json` |
| 数据库 | `memory` | 只读文件系统且无数据库 | 冷启动重置为种子数据 |
| 图片存储 | `blob` | 配置 `BLOB_READ_WRITE_TOKEN`（Vercel 上启用 **Vercel Blob** 即自动注入） | 公开 URL 直链 |
| 图片存储 | `s3` | 配置 `S3_BUCKET` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY`（可选 `S3_ENDPOINT` / `S3_REGION` / `S3_FORCE_PATH_STYLE` / `S3_PUBLIC_URL`） | 兼容阿里云 OSS、MinIO、Supabase Storage 等；未配置公开域名时经 `/api/files/[key]` 代理 |
| 图片存储 | `local` | 本地可写文件系统（默认） | `.data/uploads`，经 `/api/files/[key]` 访问 |
| 图片存储 | `inline` | 无以上任何配置 | base64 内联存入数据库文档 |

也可用 `DB_DRIVER`（postgres/file/memory）与 `STORAGE_DRIVER`（blob/s3/local/inline）显式指定。当前生效的驱动可在系统「设置 → 存储与部署状态」中查看。

### 本地运行

```bash
npm install
npm run dev        # http://localhost:3000
```

本地默认：数据持久化到 `.data/db.json`、图片存到 `.data/uploads/`（均已 gitignore）。删除 `.data` 或在「设置」页点击「重置为种子数据」即可复原演示数据。

### 部署到 Vercel

1. 将仓库导入 Vercel（Framework 自动识别为 Next.js）。
2. **推荐**：在 Vercel 项目的 Storage 页签安装 **Supabase**（Postgres）集成与 **Blob** 存储 —— 环境变量自动注入，数据即获得持久化；不安装也能运行（内存 + 内联模式，冷启动重置数据）。
3. （可选）配置上述 `AI_*` 变量。
4. Deploy。

> 注意：批改任务通过 `after()` 在响应后异步执行，`maxDuration` 设为 60s；如使用响应较慢的推理型 VLM，可在 `app/api/grading/tasks/route.ts` 中调大（需 Fluid Compute / Pro 计划）。原型将业务状态作为单文档整体读写，多实例并发写入可能相互覆盖，正式版将迁移到规范化关系表结构。

### 与生产架构的对应关系

原型为便于零依赖部署做了轻量替代，生产版将按 PRD 5.2 落地：

| 原型实现 | 生产架构（PRD） |
| --- | --- |
| Next.js API Routes | FastAPI（Python 3.11+） |
| 单文档存储（JSON 文件 / Postgres jsonb） | PostgreSQL 规范化表结构 + Redis |
| `after()` 服务端异步任务 + 前端轮询 | Celery + Redis Broker |
| Vercel Blob / S3(OSS/MinIO) / 本地文件 / 内联 | MinIO / 阿里 OSS |
| 字符串相似度知识点匹配 | Embedding 向量语义匹配 + LLM rerank（LangGraph 工作流） |
