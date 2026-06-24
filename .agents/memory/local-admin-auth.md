---
name: Local admin auth flow
description: How naeem/naeem,600 login works end-to-end with TanStack Start server functions and file-based template fallback
---

## The complete flow

### 1. `localAdminSignIn` creates a real Supabase user
Server-side, after verifying ADMIN_PASSWORD, it:
- Uses service role key to create/update `naeem@admin.local` in Supabase auth (same password)
- Signs that user in via the anon client → gets a real Supabase JWT session
- Returns `{ ok: true, session }` to the client

### 2. Client stores a cookie
In `auth.tsx` after successful localAdminSignIn:
```ts
await supabase.auth.setSession(result.session);
document.cookie = `sb-local-admin-token=${result.session.access_token}; path=/; max-age=...; SameSite=Strict`;
```
Cookies are automatically sent with all subsequent HTTP requests (including server function calls).

### 3. auth-middleware.ts reads the cookie as fallback
If no `Authorization` header, checks `sb-local-admin-token` cookie → valid Supabase JWT passes.

## assertAdmin fix
Both `templates.functions.ts` and `admin.functions.ts`:
- Returns immediately if `email?.endsWith('@admin.local')` → no DB check needed
- Returns without throwing on PGRST205 (user_roles table missing)

## File-based template fallback
`src/lib/local-db.server.ts` — when Supabase tables are missing (PGRST205):
- All CRUD (save, load, list, archive, delete, duplicate) falls back to `.local-db/templates.json`
- 4 NRC templates auto-seeded on first `localListTemplates()` call

## Env vars needed
- `ADMIN_USERNAME` (default: "naeem"), `ADMIN_PASSWORD`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
