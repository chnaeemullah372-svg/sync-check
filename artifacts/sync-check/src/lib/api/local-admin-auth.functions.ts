import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const localAdminSignIn = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string(), password: z.string() }))
  .handler(async ({ data }) => {
    const adminUser = process.env.ADMIN_USERNAME ?? "naeem";
    const adminPass = process.env.ADMIN_PASSWORD ?? "naeem,600";
    if (!adminPass) return { ok: false as const, session: null };
    if (data.username.trim() !== adminUser || data.password !== adminPass) {
      return { ok: false as const, session: null };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) {
      return { ok: true as const, session: null };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminEmail = `${adminUser}@admin.local`;

      const svcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Ensure admin user exists in Supabase auth
      const { data: listData } = await svcClient.auth.admin.listUsers({ perPage: 1000 });
      const existing = listData?.users?.find((u) => u.email === adminEmail);

      if (!existing) {
        await svcClient.auth.admin.createUser({
          email: adminEmail,
          password: adminPass,
          email_confirm: true,
          user_metadata: { role: "admin", username: adminUser },
        });
      } else {
        await svcClient.auth.admin.updateUserById(existing.id, {
          password: adminPass,
          email_confirm: true,
        });
      }

      // Best-effort: seed user_roles (table may not exist yet)
      try {
        const uid = existing?.id ?? listData?.users?.find((u) => u.email === adminEmail)?.id;
        if (uid) {
          await svcClient
            .from("user_roles")
            .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id,role" });
        }
      } catch {
        /* user_roles table not set up yet */
      }

      // Sign in to obtain a real Supabase session JWT
      const anonClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPass,
      });

      if (!signInErr && signInData?.session) {
        return { ok: true as const, session: signInData.session };
      }
    } catch {
      /* Supabase unreachable — fall back to local-only mode */
    }

    return { ok: true as const, session: null };
  });
