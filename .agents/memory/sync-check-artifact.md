---
name: sync-check artifact
description: Deployment and runtime quirks for the sync-check TanStack Start artifact
---

## Deployment health check

- Health check path must be `/healthz` (NOT `/auth` or `/`)
- `/healthz` is handled in `src/server.ts` BEFORE TanStack Start SSR — instant 200, no cold-start risk
- `artifact.toml` `[services.production.run.env]` must NOT include `PORT` — let Cloud Run assign it; `[services.env] PORT = "21974"` is fine for dev proxy only
- Health check at `/auth` causes promote-step failure on autoscale: full SSR in cold Cloud Run container times out the startup probe

## Port setup

- Dev: `localPort = 21974`, `[services.env] PORT = "21974"` → vite dev listens on 21974, proxy routes to 21974
- Prod: No PORT in `[services.production.run.env]` → Cloud Run assigns PORT, nitro node-server reads it

## @tanstack/query-core

- Must be a direct dependency (not just peer) for the prod rollup build to succeed

## Local admin auth

- Files: `src/lib/api/local-admin-auth.functions.ts`, modified `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/hooks/use-auth.tsx`
- Credentials stored as shared env vars: ADMIN_USERNAME=naeem, ADMIN_PASSWORD=naeem,600
- Bypasses Supabase; stores session in localStorage key `local-admin-session`

## Build command

- `pnpm --filter @workspace/sync-check run build` — runs vite + nitro node-server preset → `.output/server/index.mjs`
- Run command: `node artifacts/sync-check/.output/server/index.mjs` (relative to workspace root)
