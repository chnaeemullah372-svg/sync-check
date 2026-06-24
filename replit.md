# Sync Check

A National-ID / card designer and case-management admin app (TanStack Start + React 19 + Supabase). Users log in, design ID-card templates from PSDs, and auto-fill them. Brought into this Replit workspace as the `sync-check` artifact.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sync-check/` — the Sync Check app (TanStack Start SSR). Source under `src/`, Supabase client + migrations under `supabase/`, build config in `vite.config.ts`.
- `artifacts/sync-check/.replit-artifact/artifact.toml` — service/deploy config (Node SSR server).

## Architecture decisions

- This repl is locked to the artifact model; external apps run as artifacts under `artifacts/`, not as the workspace root.
- Sync Check builds a standalone Node server via nitro `node-server` preset (overrides the lovable config's cloudflare default); production runs `node .output/server/index.mjs`.
- `@tanstack/query-core` is a direct dependency to satisfy the production rollup build (see `.agents/memory/sync-check-artifact.md`).

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
