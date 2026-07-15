# AGENTS.md

## Cursor Cloud specific instructions

This repository contains the PRD (`docs/internal-smart-tutoring-prd-v1.md`) and a **runnable full-stack prototype** of the AI tutoring-school management platform, product name "赛酷逻智慧托辅系统" (fixed in `lib/constants.ts`; campus name/logo are editable in settings, default "UNIQUE").

### Stack

- Next.js 15 (App Router, Turbopack) + TypeScript + TailwindCSS v4 + Recharts + TanStack Query.
- Full-stack in one Next.js app: UI pages under `app/(main)/`, REST API under `app/api/`, domain logic under `lib/` (store, auth/RBAC, seed data, AI provider layer under `lib/ai/`).
- Pluggable persistence (`lib/persistence.ts`): Postgres when `DATABASE_URL`/`POSTGRES_URL` is set (e.g. Vercel Supabase integration; whole state stored as one jsonb row in `app_state`), else local `.data/db.json`, else in-memory. Async API: `await getDB()` / `await saveDB()`.
- Pluggable image storage (`lib/storage.ts`): Vercel Blob (`BLOB_READ_WRITE_TOKEN`), S3-compatible OSS/MinIO (`S3_*` vars), local `.data/uploads` served via `/api/files/[key]`, or inline base64. Override with `STORAGE_DRIVER` / `DB_DRIVER`.
- AI calls go through an OpenAI-compatible client (`lib/ai/client.ts`) with a provider registry (`lib/ai/providers.ts`); the default `mock` provider needs no API key and returns deterministic demo results.

### Commands

- Install: `npm install`
- Dev server: `npm run dev` (port 3000)
- Lint: `npm run lint`
- Production build: `npm run build`
- No test suite yet.

### Notes

- Demo login is passwordless: pick one of the seeded roles (principal / grade leader / teacher) on `/login`; session is a cookie with the teacher id.
- Real AI providers are configured at runtime on the settings page (principal role) or via `AI_PROVIDER` / `AI_MODEL` / `AI_API_KEY` / `AI_BASE_URL` env vars.
- Grading tasks run asynchronously after the POST response via `next/server`'s `after()`; the frontend polls task status.
