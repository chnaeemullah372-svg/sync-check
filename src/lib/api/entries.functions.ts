import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { inferTemplateMemberCount, withMemberTemplateMeta } from "@/lib/designer/member-template";

/** ---------- list assigned templates ---------- */
export const listMyTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("user_templates")
      .select(
        "template_id, templates:template_id(id, name, category, width, height, background_url, archived_at)",
      );
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r: any) => r.templates)
      .filter((t: any) => t && !t.archived_at);
  });

/** ---------- list my entries ---------- */
export const listMyEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid().optional() }).optional())
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("entries")
      .select("id, entry_no, status, template_id, updated_at, templates:template_id(name)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (data?.templateId) q = q.eq("template_id", data.templateId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** ---------- get one entry + snapshot ---------- */
export const getEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entryId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error } = await supabase
      .from("entries")
      .select(
        "id, entry_no, status, template_id, user_id, updated_at, templates:template_id(id, name, width, height, background_url, ai_fields, ai_instructions, members_per_page)",
      )
      .eq("id", data.entryId)
      .single();
    if (error) throw new Error(error.message);
    if (entry.user_id !== userId) throw new Error("Forbidden: not your entry");

    const { data: snap } = await supabase
      .from("template_objects")
      .select("objects")
      .eq("template_id", entry.template_id)
      .maybeSingle();

    const { data: members } = await supabase
      .from("entry_members")
      .select("id, member_no, data")
      .eq("entry_id", data.entryId)
      .order("member_no", { ascending: true });

    const { data: files } = await supabase
      .from("entry_files")
      .select("id, member_id, file_type, file_url, meta")
      .eq("entry_id", data.entryId);

    // Ensure canvas dimensions are always present (fall back to template w/h)
    let snapshot: any = snap?.objects ?? null;
    if (snapshot && typeof snapshot === "object") {
      const tpl: any = (entry as any).templates ?? {};
      snapshot = withMemberTemplateMeta({
        ...snapshot,
        canvasWidth: Number(snapshot.canvasWidth ?? tpl.width ?? 794) || 794,
        canvasHeight: Number(snapshot.canvasHeight ?? tpl.height ?? 1123) || 1123,
      }, tpl.name, tpl.members_per_page);
    }
    return { entry, snapshot, members: members ?? [], files: files ?? [] };
  });

/** ---------- create entry ---------- */
export const createEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ templateId: z.string().uuid(), memberCount: z.number().int().min(1).max(20).optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: assigned } = await supabase
      .from("user_templates")
      .select("id")
      .eq("user_id", userId)
      .eq("template_id", data.templateId)
      .maybeSingle();
    if (!assigned) throw new Error("Forbidden: template not assigned to you");

    const { data: tpl } = await supabase
      .from("templates")
      .select("name, members_per_page, template_objects(objects)")
      .eq("id", data.templateId)
      .single();

    const snapshot = Array.isArray((tpl as any)?.template_objects)
      ? (tpl as any).template_objects[0]?.objects
      : (tpl as any)?.template_objects?.objects;
    const defaultCount = inferTemplateMemberCount({ snapshot, templateName: (tpl as any)?.name });

    const { data: ins, error } = await supabase
      .from("entries")
      .insert({ template_id: data.templateId, user_id: userId, status: "draft" })
      .select("id, entry_no")
      .single();
    if (error) throw new Error(error.message);
    const memberCount = Math.max(1, Math.min(20, data.memberCount ?? defaultCount));
    const rows = Array.from({ length: memberCount }, (_, i) => ({
      entry_id: ins.id,
      member_no: i + 1,
      data: {},
    }));
    const { error: memberError } = await supabase.from("entry_members").insert(rows);
    if (memberError) throw new Error(memberError.message);
    return ins;
  });

/** ---------- save member data ---------- */
export const saveEntryMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      entryId: z.string().uuid(),
      memberNo: z.number().int().min(1).max(50),
      data: z.record(z.string(), z.any()),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing } = await supabase
      .from("entry_members")
      .select("id")
      .eq("entry_id", data.entryId)
      .eq("member_no", data.memberNo)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("entry_members")
        .update({ data: data.data })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: ins, error } = await supabase
      .from("entry_members")
      .insert({ entry_id: data.entryId, member_no: data.memberNo, data: data.data })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

/** ---------- delete member ---------- */
export const deleteEntryMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entryId: z.string().uuid(), memberNo: z.number().int() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("entry_members")
      .delete()
      .eq("entry_id", data.entryId)
      .eq("member_no", data.memberNo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ---------- record a file upload ---------- */
export const saveEntryFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      entryId: z.string().uuid(),
      memberId: z.string().uuid().nullable().optional(),
      fileType: z.string().max(40),
      fileUrl: z.string().max(2000),
      meta: z.record(z.string(), z.any()).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase
      .from("entry_files")
      .insert({
        entry_id: data.entryId,
        member_id: data.memberId ?? null,
        file_type: data.fileType,
        file_url: data.fileUrl,
        meta: data.meta ?? {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

/** ---------- autosave (server mirror) ---------- */
export const autosaveEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      entryId: z.string().uuid(),
      templateId: z.string().uuid(),
      formData: z.any(),
      imagesMeta: z.any().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("entry_auto_saves")
      .select("id")
      .eq("user_id", userId)
      .eq("entry_id", data.entryId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("entry_auto_saves")
        .update({ form_data: data.formData, images_meta: data.imagesMeta ?? {} })
        .eq("id", existing.id);
    } else {
      await supabase.from("entry_auto_saves").insert({
        user_id: userId,
        entry_id: data.entryId,
        template_id: data.templateId,
        form_data: data.formData,
        images_meta: data.imagesMeta ?? {},
      });
    }
    return { ok: true };
  });

export const loadAutosave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entryId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("entry_auto_saves")
      .select("form_data, images_meta, updated_at")
      .eq("entry_id", data.entryId)
      .eq("user_id", context.userId)
      .maybeSingle();
    return row ?? null;
  });

/** ---------- update entry status ---------- */
export const setEntryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ entryId: z.string().uuid(), status: z.enum(["draft", "final"]) }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("entries")
      .update({ status: data.status })
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ---------- record export ---------- */
export const recordExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      entryId: z.string().uuid(),
      exportType: z.enum(["pdf", "jpg"]),
      fileUrl: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("exports").insert({
      entry_id: data.entryId,
      user_id: context.userId,
      export_type: data.exportType,
      file_url: data.fileUrl ?? null,
    });
    return { ok: true };
  });

/** ---------- delete entry ---------- */
export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entryId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("entries")
      .delete()
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAllMyEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}).optional())
  .handler(async ({ context }) => {
    const { error, count } = await context.supabase
      .from("entries")
      .delete({ count: "exact" })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });
