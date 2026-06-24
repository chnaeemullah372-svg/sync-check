---
name: sync-check artifact (TanStack Start app)
description: How the external sync-check TanStack Start app runs inside this Replit workspace as a Node-SSR artifact; build/deploy gotchas.
---

# sync-check (TanStack Start) as a Replit artifact

The external app (GitHub chnaeemullah372-svg/sync-check; live admin.punjab-case-management.live)
is brought in as the `artifacts/sync-check` web artifact (previewPath `/`).

## This repl is locked to the artifact model
`.replit` cannot be edited (`router = "application"`). Deploy REQUIRES an artifact with a
`.replit-artifact/artifact.toml`. Do NOT try to make an external app the workspace root —
it must become an artifact under `artifacts/`.
**Why:** earlier attempts to run the app as workspace root could not deploy.

## nitro preset must be node-server
The app's `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which defaults nitro
to a **cloudflare** target. For a Replit Node production server, override
`nitro: { preset: "node-server" }` in `defineConfig`. Production build then emits
`.output/server/index.mjs`, run with `node .output/server/index.mjs` (respects `PORT`,
binds all interfaces). artifact.toml uses `[services.production.run]` like api-server.
**How to apply:** any TanStack-Start/lovable artifact that must deploy on Replit.

## Replit is not detected as a sandbox by the lovable config
So host/port are NOT auto-set. Set them manually in `defineConfig({ vite: { server: {
host: "0.0.0.0", port: Number(process.env.PORT)||5000, strictPort: true,
allowedHosts: true }, preview: {...same} } })`. PORT is injected via artifact.toml
`[services.env]`.

## pnpm production build fails on @tanstack/query-core
`vite build` (rollup, production) fails: "Rollup failed to resolve import
@tanstack/query-core from @tanstack/react-query". Dev works (Vite prebundles), prod
rollup does not resolve react-query's bare ESM import of query-core through pnpm symlinks.
**Fix:** add `@tanstack/query-core` as a DIRECT dependency in the artifact's package.json.
(Tried `shamefully-hoist=true` — pnpm aborts the relayout without `CI=true` and it is a
heavier blast radius; the direct-dep fix is surgical and sufficient.)

## App keeps its own exact deps, not the workspace catalog
The app uses explicit versions (React 19.2, etc.), NOT `catalog:` refs. Keep it that way —
this is the combination verified to build/run. Its `tsconfig.json` is self-contained
(does not extend the workspace base, no lib references).
