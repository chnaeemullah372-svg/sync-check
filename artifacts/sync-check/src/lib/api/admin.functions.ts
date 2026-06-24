import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

/** Create a new user (email + password). Auto-assigns role "user". */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(6).max(72),
      displayName: z.string().trim().min(1).max(100).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.displayName ? { display_name: data.displayName } : undefined,
    });
    if (error) throw new Error(error.message);
    return { id: created.user!.id, email: created.user!.email };
  });

/** List all non-admin users with their assigned template ids. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: assignments } = await supabaseAdmin
      .from("user_templates")
      .select("user_id, template_id");

    const roleMap = new Map<string, string>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role));

    const assignMap = new Map<string, string[]>();
    assignments?.forEach((a) => {
      const arr = assignMap.get(a.user_id) ?? [];
      arr.push(a.template_id);
      assignMap.set(a.user_id, arr);
    });

    return list.users
      .filter((u) => roleMap.get(u.id) !== "admin")
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        displayName: (u.user_metadata?.display_name as string) ?? null,
        role: roleMap.get(u.id) ?? "user",
        templateIds: assignMap.get(u.id) ?? [],
        banned: !!u.banned_until,
        createdAt: u.created_at,
      }));
  });

/** Disable or re-enable a user account. */
export const adminSetUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), disabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.disabled ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reset a user's password. */
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a user account. */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Replace a user's full template assignment list. */
export const adminSetUserTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      templateIds: z.array(z.string().uuid()).max(500),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_templates")
      .select("template_id")
      .eq("user_id", data.userId);
    const existingIds = new Set((existing ?? []).map((r) => r.template_id));
    const targetIds = new Set(data.templateIds);

    const toAdd = [...targetIds].filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !targetIds.has(id));

    if (toAdd.length > 0) {
      const rows = toAdd.map((tid) => ({
        user_id: data.userId,
        template_id: tid,
        assigned_by: context.userId,
      }));
      const { error } = await supabaseAdmin.from("user_templates").insert(rows);
      if (error) throw new Error(error.message);
    }
    if (toRemove.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_templates")
        .delete()
        .eq("user_id", data.userId)
        .in("template_id", toRemove);
      if (error) throw new Error(error.message);
    }
    return { added: toAdd.length, removed: toRemove.length };
  });

/** Archive or unarchive a template. */
export const adminSetTemplateArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("templates")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.templateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Permanently delete a template (admin only). */
export const adminDeleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("templates").delete().eq("id", data.templateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update template name/category. */
export const adminUpdateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      templateId: z.string().uuid(),
      name: z.string().trim().min(1).max(120).optional(),
      category: z.string().trim().max(60).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { name?: string; category?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.category !== undefined) patch.category = data.category;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("templates").update(patch).eq("id", data.templateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
