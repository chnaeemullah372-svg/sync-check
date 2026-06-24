import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Allow admin if:
 *  (a) email is the local-admin address (@admin.local), OR
 *  (b) user_roles table confirms admin role, OR
 *  (c) user_roles table doesn't exist yet (PGRST205) — authenticated = trusted
 */
async function assertAdmin(userId: string, email?: string | null) {
  if (email?.endsWith("@admin.local")) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error?.code === "PGRST205" || error?.message?.includes("user_roles")) return;
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

function isTableMissingError(e: unknown): boolean {
  const msg = (e as { message?: string; code?: string })?.message ?? "";
  const code = (e as { code?: string })?.code ?? "";
  return code === "PGRST205" || msg.includes("PGRST205") || msg.includes("relation") || msg.includes("does not exist");
}

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      templateId: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(120),
      pageSize: z.string().max(20).default("custom"),
      width: z.number().int().positive().max(20000),
      height: z.number().int().positive().max(20000),
      backgroundUrl: z.string().max(5_000_000).nullable().optional(),
      snapshot: z.any(),
      category: z.string().trim().max(60).nullable().optional(),
      aiInstructions: z.string().max(4000).nullable().optional(),
      membersPerPage: z.number().int().min(1).max(20).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, (context.claims as Record<string, unknown>)?.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let templateId = data.templateId;
    try {
      if (templateId) {
        const { error } = await supabaseAdmin
          .from("templates")
          .update({
            name: data.name,
            page_size: data.pageSize,
            width: data.width,
            height: data.height,
            background_url: data.backgroundUrl ?? null,
            category: data.category ?? null,
            ai_instructions: data.aiInstructions ?? null,
            members_per_page: data.membersPerPage ?? null,
            status: "active",
          })
          .eq("id", templateId);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabaseAdmin
          .from("templates")
          .insert({
            name: data.name,
            page_size: data.pageSize,
            width: data.width,
            height: data.height,
            background_url: data.backgroundUrl ?? null,
            category: data.category ?? null,
            ai_instructions: data.aiInstructions ?? null,
            members_per_page: data.membersPerPage ?? null,
            status: "active",
            created_by: context.userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        templateId = ins.id;
      }

      const { data: existing } = await supabaseAdmin
        .from("template_objects")
        .select("id, version")
        .eq("template_id", templateId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("template_objects")
          .update({
            objects: data.snapshot ?? [],
            version: (existing.version ?? 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("template_objects").insert({
          template_id: templateId,
          objects: data.snapshot ?? [],
          version: 1,
        });
        if (error) throw error;
      }

      return { id: templateId! };
    } catch (e) {
      if (isTableMissingError(e)) {
        const { localSaveTemplate } = await import("@/lib/local-db.server");
        const id = localSaveTemplate({
          templateId: data.templateId,
          name: data.name,
          pageSize: data.pageSize,
          width: data.width,
          height: data.height,
          backgroundUrl: data.backgroundUrl,
          category: data.category,
          aiInstructions: data.aiInstructions,
          membersPerPage: data.membersPerPage,
          snapshot: data.snapshot,
          createdBy: context.userId,
        });
        return { id };
      }
      throw new Error((e as Error).message ?? String(e));
    }
  });

export const loadTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data: tpl, error } = await supabaseAdmin
        .from("templates")
        .select("id, name, page_size, width, height, background_url, category, ai_instructions")
        .eq("id", data.templateId)
        .single();
      if (error) throw error;
      const { data: obj } = await supabaseAdmin
        .from("template_objects")
        .select("objects")
        .eq("template_id", data.templateId)
        .maybeSingle();
      return { template: tpl, snapshot: obj?.objects ?? null };
    } catch (e) {
      if (isTableMissingError(e)) {
        const { localGetTemplate, localGetTemplateObjects } = await import("@/lib/local-db.server");
        const tpl = localGetTemplate(data.templateId);
        if (!tpl) throw new Error("Template not found");
        const obj = localGetTemplateObjects(data.templateId);
        return { template: tpl, snapshot: obj?.objects ?? null };
      }
      throw new Error((e as Error).message ?? String(e));
    }
  });

export const duplicateTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, (context.claims as Record<string, unknown>)?.email as string | undefined);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data: src, error } = await supabaseAdmin
        .from("templates")
        .select("name, page_size, width, height, background_url, category, ai_instructions")
        .eq("id", data.templateId)
        .single();
      if (error) throw error;
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("templates")
        .insert({
          name: `${src.name} (copy)`,
          page_size: src.page_size,
          width: src.width,
          height: src.height,
          background_url: src.background_url,
          category: src.category,
          ai_instructions: src.ai_instructions,
          status: "active",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const { data: obj } = await supabaseAdmin
        .from("template_objects")
        .select("objects")
        .eq("template_id", data.templateId)
        .maybeSingle();
      await supabaseAdmin.from("template_objects").insert({
        template_id: ins.id,
        objects: obj?.objects ?? [],
        version: 1,
      });
      return { id: ins.id };
    } catch (e) {
      if (isTableMissingError(e)) {
        const { localDuplicateTemplate } = await import("@/lib/local-db.server");
        const id = localDuplicateTemplate(data.templateId);
        return { id };
      }
      throw new Error((e as Error).message ?? String(e));
    }
  });

/** List templates from local file store. No auth required — local files are not user data. */
export const listLocalTemplatesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { localListTemplates } = await import("@/lib/local-db.server");
    return localListTemplates();
  });
