# AGENTS.md

## Cursor Cloud specific instructions

This repository is currently **documentation-only** (pre-implementation / spec stage). Tracked files:

- `README.md` — project intro (Chinese) for "UniqueAITutorialSchool", an AI-driven tutoring-school management platform.
- `docs/internal-smart-tutoring-prd-v1.md` — the product requirements document (PRD V1.0).
- `LICENSE`.

There is **no application code, dependency manifest (no `package.json` / `requirements.txt` / `pyproject.toml`), build system, test suite, or runnable service** yet. Consequently:

- There is nothing to install, lint, test, build, or run. The environment update script is intentionally a no-op.
- The PRD (`docs/internal-smart-tutoring-prd-v1.md`) only describes the *planned* stack: Next.js 15 + TypeScript frontend, FastAPI (Python 3.11+) backend, Celery + Redis for async AI tasks, PostgreSQL, object storage (MinIO/OSS), and external Chinese VLM APIs (Qwen-VL, Doubao). None of this is implemented.

When application code and a dependency manifest are eventually added, update the environment update script to install the relevant dependencies, and update this section with how to run/lint/test/build the new service(s).
