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

/**
 * Save (create or update) a template into the database.
 * The full designer snapshot (layers + background + memberNames) is stored
 * as JSON in `template_objects.objects`.
 */
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
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let templateId = data.templateId;
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
          status: "active",
        })
        .eq("id", templateId);
      if (error) throw new Error(error.message);
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
          status: "active",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
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
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("template_objects").insert({
        template_id: templateId,
        objects: data.snapshot ?? [],
        version: 1,
      });
      if (error) throw new Error(error.message);
    }

    return { id: templateId };
  });

export const loadTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    // Read-only: any authenticated user (admin or regular) can load a template
    // into the designer for viewing or per-user customization. RLS-equivalent
    // gating happens at the higher layer (user must already have access to
    // entries pointing at this template).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl, error } = await supabaseAdmin
      .from("templates")
      .select("id, name, page_size, width, height, background_url, category, ai_instructions")
      .eq("id", data.templateId)
      .single();
    if (error) throw new Error(error.message);
    const { data: obj } = await supabaseAdmin
      .from("template_objects")
      .select("objects")
      .eq("template_id", data.templateId)
      .maybeSingle();
    return { template: tpl, snapshot: obj?.objects ?? null };
  });

/** Duplicate a template (copies row + template_objects snapshot). */
export const duplicateTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src, error } = await supabaseAdmin
      .from("templates")
      .select("name, page_size, width, height, background_url, category, ai_instructions")
      .eq("id", data.templateId)
      .single();
    if (error) throw new Error(error.message);
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
    if (insErr) throw new Error(insErr.message);
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
  });


