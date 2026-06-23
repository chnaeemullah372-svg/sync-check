import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
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
      membersPerPage: z.number().int().min(1).max(20).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = context.supabase;

    let templateId = data.templateId;
    if (templateId) {
      const { error } = await supabase
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
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabase
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
      if (error) throw new Error(error.message);
      templateId = ins.id;
    }

    const { data: existing } = await supabase
      .from("template_objects")
      .select("id, version")
      .eq("template_id", templateId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("template_objects")
        .update({
          objects: data.snapshot ?? [],
          version: (existing.version ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("template_objects").insert({
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
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: tpl, error } = await supabase
      .from("templates")
      .select("id, name, page_size, width, height, background_url, category, ai_instructions")
      .eq("id", data.templateId)
      .single();
    if (error) throw new Error(error.message);
    const { data: obj } = await supabase
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
    await assertAdmin(context);
    const supabase = context.supabase;
    const { data: src, error } = await supabase
      .from("templates")
      .select("name, page_size, width, height, background_url, category, ai_instructions")
      .eq("id", data.templateId)
      .single();
    if (error) throw new Error(error.message);
    const { data: ins, error: insErr } = await supabase
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
    const { data: obj } = await supabase
      .from("template_objects")
      .select("objects")
      .eq("template_id", data.templateId)
      .maybeSingle();
    await supabase.from("template_objects").insert({
      template_id: ins.id,
      objects: obj?.objects ?? [],
      version: 1,
    });
    return { id: ins.id };
  });


