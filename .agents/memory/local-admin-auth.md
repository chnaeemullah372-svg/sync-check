---
name: Local admin auth
description: How admin login works without Supabase service_role key — env-var-validated server function + localStorage session token.
---

# Local Admin Auth

## The rule
Username "naeem" (ADMIN_USERNAME env var) bypasses Supabase auth entirely. A TanStack Start server function validates the password against ADMIN_PASSWORD env var, then the client stores a `local_admin_session` JSON in localStorage (24 h TTL).

**Why:** The Supabase project (eemqusgtziqtgiomlqae) has signups disabled; naeem@admin.local was never created there; and the service_role key was not provided. Local auth lets the admin log in without any Supabase dependency.

**How to apply:**
- `src/lib/api/local-admin-auth.functions.ts` — server function
- `src/routes/auth.tsx` — checks username === 'naeem' first; stores localStorage token on success
- `src/routes/_authenticated/route.tsx` — `getLocalAdminSession()` fallback in beforeLoad
- `src/hooks/use-auth.tsx` — reads localStorage; sets role='admin' and fake User object; clears on signOut
- Env vars: `ADMIN_USERNAME=naeem`, `ADMIN_PASSWORD=naeem,600` (shared)
- Templates/AI server functions STILL need real SUPABASE_SERVICE_ROLE_KEY — provide later.
