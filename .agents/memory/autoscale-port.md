---
name: Autoscale PORT pitfall
description: Why hardcoding PORT in [services.env] breaks Replit autoscale health checks and how to fix it.
---

## Rule

Never put `PORT` in `[services.env]` of an artifact's `artifact.toml`. Put it only in `[services.development.env]`.

**Why:** `[services.env]` applies to BOTH dev and production. Replit's autoscale deployer (Cloud Run) assigns a dynamic PORT to the production container at runtime and health-checks on that exact port. If `[services.env]` hardcodes `PORT = "21974"`, the server binds to 21974 but the deployer's health probe goes to the platform-assigned port → health check times out → promote step fails → build marked `failed`, even though the vite/nitro build itself succeeded.

**How to apply:** For any autoscale artifact with a nitro node-server (or any server that reads `process.env.PORT`):

```toml
# WRONG — PORT leaks into production, breaks health check
[services.env]
PORT = "21974"

# CORRECT — PORT only in dev; production gets platform-assigned PORT
[services.development.env]
PORT = "21974"
```

The `[services.env]` block should only hold values safe for both environments (e.g. `BASE_PATH`). `NODE_ENV` and other production-specific vars go in `[services.production.run.env]`.
