import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FieldMeta = z.object({
  key: z.string().min(1).max(200),
  label: z.string().max(200).optional(),
  subtype: z.string().max(60).optional(),
  aiInstruction: z.string().max(2000).optional(),
  expectedLanguage: z.enum(["urdu", "english", "roman", "mixed", "numeric", "image", "auto"]).optional(),
  rtl: z.boolean().optional(),
});

const PROVIDER_KEY_NAMES: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

async function loadProviderKey(
  provider: "openai" | "gemini" | "claude" | null,
  supabase?: any,
): Promise<string | null> {
  if (!provider) return null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from("ai_provider_keys")
        .select("api_key")
        .eq("provider", provider)
        .maybeSingle();
      if (data?.api_key) return data.api_key as string;
    } catch { /* ignore */ }
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_provider_keys")
      .select("api_key")
      .eq("provider", provider)
      .maybeSingle();
    if (data?.api_key) return data.api_key as string;
  } catch { /* ignore */ }
  return process.env[PROVIDER_KEY_NAMES[provider]] ?? null;
}

async function assertAiAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

/** Public: returns AI mode + user's allowed modes + whether advanced provider key is configured. */
export const getAiContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: settings }, { data: access }] = await Promise.all([
      context.supabase.from("ai_settings").select("mode, provider").eq("id", 1).maybeSingle(),
      context.supabase.from("user_ai_access").select("access").eq("user_id", context.userId).maybeSingle(),
    ]);
    const mode = (settings?.mode ?? "standard") as "disabled" | "standard" | "advanced";
    const provider = (settings?.provider ?? null) as "openai" | "gemini" | "claude" | null;
    const userAccess = (access?.access ?? "standard") as "disabled" | "standard" | "advanced" | "both";
    const key = await loadProviderKey(provider, context.supabase);
    const advancedConfigured = !!provider && !!key;
    return { mode, provider, userAccess, advancedConfigured };
  });

/** Admin: list which providers have a key configured (no key values returned). */
export const listProviderKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAiAdmin(context);
    const { data } = await context.supabase
      .from("ai_provider_keys")
      .select("provider, updated_at");
    const map: Record<string, { configured: boolean; updatedAt?: string }> = {
      openai: { configured: false },
      gemini: { configured: false },
      claude: { configured: false },
    };
    for (const r of data ?? []) {
      map[r.provider as string] = { configured: true, updatedAt: r.updated_at as string };
    }
    // Also reflect env-provided keys
    for (const p of ["openai", "gemini", "claude"] as const) {
      if (!map[p].configured && process.env[PROVIDER_KEY_NAMES[p]]) {
        map[p] = { configured: true };
      }
    }
    return map;
  });

/** Admin: save (or clear) a provider API key. */
export const setProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      provider: z.enum(["openai", "gemini", "claude"]),
      apiKey: z.string().max(500),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAiAdmin(context);
    const trimmed = data.apiKey.trim();
    if (trimmed === "") {
      const { error } = await context.supabase
        .from("ai_provider_keys")
        .delete()
        .eq("provider", data.provider);
      if (error) throw new Error(error.message);
      return { ok: true, cleared: true };
    }
    if (trimmed.length < 10) throw new Error("API key looks too short.");
    const { error } = await context.supabase
      .from("ai_provider_keys")
      .upsert({
        provider: data.provider,
        api_key: trimmed,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true, cleared: false };
  });

/** Admin: update global AI settings (mode + provider). API keys live in env secrets only. */
export const setAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      mode: z.enum(["disabled", "standard", "advanced"]),
      provider: z.enum(["openai", "gemini", "claude"]).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAiAdmin(context);
    const { error } = await context.supabase
      .from("ai_settings")
      .upsert({ id: 1, mode: data.mode, provider: data.provider ?? null, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error(error.message);
    const key = data.provider ? await loadProviderKey(data.provider, context.supabase) : null;
    const providerConfigured = !!key;
    return { ok: true, providerConfigured };
  });

/** Admin: set per-user AI access. */
export const setUserAiAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), access: z.enum(["disabled", "standard", "advanced", "both"]) }))
  .handler(async ({ data, context }) => {
    await assertAiAdmin(context);
    const { error } = await context.supabase
      .from("user_ai_access")
      .upsert({ user_id: data.userId, access: data.access, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: list per-user AI access (returns map userId -> access). */
export const listUserAiAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAiAdmin(context);
    const { data } = await context.supabase.from("user_ai_access").select("user_id, access");
    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.user_id] = r.access;
    return map;
  });

/** Admin: usage logs (most recent first). */
export const listAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAiAdmin(context);
    const { data } = await context.supabase
      .from("ai_usage_logs")
      .select("id, user_id, mode, provider, input_type, estimated_tokens, estimated_cost, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

const GeneratedLayer = z.object({
  name: z.string(),
  type: z.enum(["text", "image"]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fill: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  rtl: z.boolean().optional(),
  fieldKey: z.string().optional(),
  aiInstruction: z.string().optional(),
  subtype: z.string().optional(),
  fit: z.string().optional(),
  faceCrop: z.string().optional(),
});

const GeneratedTemplate = z.object({
  layers: z.array(GeneratedLayer).min(1).max(120),
  templateAiInstructions: z.string().max(4000).optional(),
});

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rect(width: number, height: number, x: number, y: number, w: number, h: number) {
  return {
    x: Math.round(clamp(x * width, 0, width - 4)),
    y: Math.round(clamp(y * height, 0, height - 4)),
    width: Math.round(clamp(w * width, 8, width)),
    height: Math.round(clamp(h * height, 8, height)),
  };
}

function cnicLayout(width: number, height: number) {
  const text = (name: string, fieldKey: string, r: ReturnType<typeof rect>, sample: string, opts: Partial<z.infer<typeof GeneratedLayer>> = {}) => ({
    name,
    type: "text" as const,
    ...r,
    text: sample,
    fontSize: opts.fontSize ?? Math.max(12, Math.round(height * 0.018)),
    fontFamily: opts.fontFamily ?? (opts.rtl ? "Jameel Noori Nastaleeq" : "Roboto Condensed"),
    fill: "#111111",
    align: opts.align ?? (opts.rtl ? "right" as const : "left" as const),
    rtl: !!opts.rtl,
    fieldKey,
    aiInstruction: opts.aiInstruction ?? `Fill ${name} from user data. Keep the same language and format.`,
  });
  const image = (name: string, fieldKey: string, r: ReturnType<typeof rect>, subtype = "photo") => ({
    name,
    type: "image" as const,
    ...r,
    src: null,
    fit: "crop",
    subtype,
    faceCrop: subtype === "photo" ? "passport" : "none",
    fieldKey,
    aiInstruction: subtype === "photo" ? "Passport-size face centered." : "Use matching uploaded image.",
  });

  return [
    image("Photo", "photo", rect(width, height, 0.095, 0.14, 0.18, 0.17), "photo"),
    image("Thumb", "thumb", rect(width, height, 0.11, 0.34, 0.15, 0.08), "thumb"),
    text("Name Urdu", "name", rect(width, height, 0.53, 0.14, 0.24, 0.04), "نام", { rtl: true, fontSize: Math.round(height * 0.022) }),
    text("Father/Husband Urdu", "father_name", rect(width, height, 0.49, 0.25, 0.28, 0.04), "والد/شوہر", { rtl: true, fontSize: Math.round(height * 0.02) }),
    text("CNIC Number", "cnic", rect(width, height, 0.35, 0.20, 0.27, 0.04), "35201-1234567-8", { fontSize: Math.round(height * 0.019), fontFamily: "Roboto Condensed" }),
    text("Gender", "custom_1", rect(width, height, 0.30, 0.31, 0.08, 0.035), "M", { fontSize: Math.round(height * 0.016), fontFamily: "Roboto Condensed" }),
    text("Date of Birth", "dob", rect(width, height, 0.52, 0.36, 0.15, 0.035), "01/01/2000", { fontSize: Math.round(height * 0.016), fontFamily: "Roboto Condensed" }),
    text("Date of Issue", "doi", rect(width, height, 0.30, 0.42, 0.15, 0.035), "01/01/2020", { fontSize: Math.round(height * 0.016), fontFamily: "Roboto Condensed" }),
    text("Date of Expiry", "custom_2", rect(width, height, 0.53, 0.42, 0.15, 0.035), "01/01/2030", { fontSize: Math.round(height * 0.016), fontFamily: "Roboto Condensed" }),
    text("Back CNIC Number", "cnic", rect(width, height, 0.64, 0.56, 0.28, 0.035), "35201-1234567-8", { fontSize: Math.round(height * 0.016), fontFamily: "Roboto Condensed" }),
    text("Family Number", "custom_3", rect(width, height, 0.31, 0.56, 0.16, 0.035), "Q340ZP", { fontSize: Math.round(height * 0.016), fontFamily: "Roboto Condensed" }),
    text("Current Address", "address", rect(width, height, 0.34, 0.62, 0.48, 0.06), "موجودہ پتہ", { rtl: true, fontSize: Math.round(height * 0.018) }),
    text("Permanent Address", "address", rect(width, height, 0.34, 0.73, 0.48, 0.06), "مستقل پتہ", { rtl: true, fontSize: Math.round(height * 0.018) }),
    text("Footer Urdu", "relation", rect(width, height, 0.25, 0.84, 0.55, 0.05), "گمشدہ کارڈ ملنے پر قریبی لیٹر بکس میں ڈال دیں", { rtl: true, fontSize: Math.round(height * 0.024) }),
  ];
}

function normalizeImageUrl(image: string) {
  return image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
}

function clampGeneratedLayer(layer: z.infer<typeof GeneratedLayer>, canvasWidth: number, canvasHeight: number) {
  const x = clamp(Math.round(layer.x), 0, Math.max(0, canvasWidth - 4));
  const y = clamp(Math.round(layer.y), 0, Math.max(0, canvasHeight - 4));
  const width = clamp(Math.round(layer.width), 8, Math.max(8, canvasWidth - x));
  const height = clamp(Math.round(layer.height), 8, Math.max(8, canvasHeight - y));
  return {
    ...layer,
    x,
    y,
    width,
    height,
    fontSize: layer.type === "text" ? clamp(Math.round(layer.fontSize ?? 18), 6, 220) : undefined,
    fontFamily: layer.type === "text" ? (layer.fontFamily || (layer.rtl ? "Jameel Noori Nastaleeq" : "Roboto Condensed")) : undefined,
    fill: layer.type === "text" ? (layer.fill || "#111111") : undefined,
    align: layer.type === "text" ? (layer.align || (layer.rtl ? "right" : "left")) : undefined,
  };
}

async function callOpenAiLayerVision(key: string, prompt: string, imageUrl: string) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a precise document template layout engine. Return only strict JSON." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI layer generation failed (${resp.status})`);
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "{}";
}

async function callGeminiLayerVision(key: string, prompt: string, imageUrl: string) {
  const [, mime, b64] = imageUrl.match(/^data:([^;]+);base64,(.+)$/) ?? [];
  if (!mime || !b64) throw new Error("Reference image must be a base64 data URL.");
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { response_mime_type: "application/json" },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini layer generation failed (${resp.status})`);
  const json: any = await resp.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callLovableLayerVision(key: string, prompt: string, imageUrl: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a precise document template layout engine. Return only strict JSON." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (resp.status === 429) throw new Error("AI rate limit hit. Try again shortly.");
  if (resp.status === 402) throw new Error("AI credits exhausted.");
  if (!resp.ok) throw new Error(`Lovable AI layer generation failed (${resp.status})`);
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "{}";
}

export const generateTemplateLayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      canvasWidth: z.number().int().positive().max(20000),
      canvasHeight: z.number().int().positive().max(20000),
      instructions: z.string().max(8000).optional(),
      referenceImage: z.string().max(8_000_000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");

    if (!data.referenceImage) {
      throw new Error("Upload a demo/reference image first. AI needs the demo file to place layers.");
    }

    const prompt = `
Create an editable document template layer layout from the uploaded demo/reference image.

Canvas size:
- width: ${data.canvasWidth}px
- height: ${data.canvasHeight}px

Admin command:
${data.instructions?.trim() || "Create editable CNIC/NADRA text and image layers matching the reference."}

Return STRICT JSON only:
{
  "layers": [
    {
      "type": "text" | "image",
      "name": "human readable layer name",
      "fieldKey": "name|father_name|cnic|dob|doi|address|photo|thumb|signature|custom_1|custom_2|custom_3",
      "x": number, "y": number, "width": number, "height": number,
      "text": "sample text for text layers",
      "fontSize": number,
      "fontFamily": "Jameel Noori Nastaleeq|Roboto Condensed|Arial|Noto Naskh Arabic",
      "rtl": boolean,
      "align": "left"|"center"|"right",
      "fill": "#111111",
      "aiInstruction": "how to fill this layer"
    }
  ],
  "templateAiInstructions": "overall user-side fill instructions"
}

Rules:
- Match the reference image positions as closely as possible in canvas pixels.
- Create separate editable layers for visible variable text fields.
- Create image placeholder layers for photo, thumb/fingerprint, signature/QR if needed.
- Urdu text must use rtl=true, right alignment, and Jameel Noori Nastaleeq unless the command says otherwise.
- Numeric fields like CNIC and dates must use Latin digits and Roboto Condensed/Arial.
- Do not return prose, markdown, comments, or explanations.
`.trim();

    const imageUrl = normalizeImageUrl(data.referenceImage);
    let raw = "{}";
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (lovableKey) {
      raw = await callLovableLayerVision(lovableKey, prompt, imageUrl);
    } else {
      const { data: settings } = await context.supabase
        .from("ai_settings")
        .select("provider")
        .eq("id", 1)
        .maybeSingle();
      const provider = (settings?.provider ?? null) as "openai" | "gemini" | "claude" | null;
      const openAiKey = provider === "openai" ? await loadProviderKey("openai", context.supabase) : await loadProviderKey("openai", context.supabase);
      const geminiKey = provider === "gemini" ? await loadProviderKey("gemini", context.supabase) : await loadProviderKey("gemini", context.supabase);
      if (provider === "gemini" && geminiKey) raw = await callGeminiLayerVision(geminiKey, prompt, imageUrl);
      else if (provider === "openai" && openAiKey) raw = await callOpenAiLayerVision(openAiKey, prompt, imageUrl);
      else if (geminiKey) raw = await callGeminiLayerVision(geminiKey, prompt, imageUrl);
      else if (openAiKey) raw = await callOpenAiLayerVision(openAiKey, prompt, imageUrl);
      else {
        throw new Error("AI vision is not configured. Add LOVABLE_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY on the server/admin settings.");
      }
    }

    let parsed: unknown = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("AI returned invalid JSON. Try again with clearer instructions.");
    }
    const generated = GeneratedTemplate.parse(parsed);
    const layers = generated.layers.map((layer) => clampGeneratedLayer(layer, data.canvasWidth, data.canvasHeight));
    return {
      layers,
      templateAiInstructions: generated.templateAiInstructions || data.instructions?.trim() || "",
      source: "vision",
    };
  });

/**
 * Extract structured fields from text or image. Honors per-user access + global mode.
 * `mode: 'advanced'` routes to the admin-configured provider (OpenAI/Gemini/Claude)
 * using a server-only env key; 'standard' uses the Lovable AI Gateway.
 */
export const extractFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      image: z.string().min(50).max(8_000_000).optional(),
      text: z.string().min(2).max(20_000).optional(),
      fields: z.array(z.string().min(1).max(200)).min(1).max(100),
      labels: z.record(z.string(), z.string().max(200)).optional(),
      fieldsMeta: z.array(FieldMeta).max(100).optional(),
      instructions: z.string().max(4000).optional(),
      mode: z.enum(["standard", "advanced"]).optional(),
      entryId: z.string().uuid().optional(),
      templateId: z.string().uuid().optional(),
      memberCount: z.number().int().min(1).max(50).optional(),
    }).refine((d) => !!d.image || !!d.text, { message: "Provide image or text" }),
  )
  .handler(async ({ data, context }) => {
    // ---------- access control ----------
    const [{ data: settings }, { data: access }] = await Promise.all([
      context.supabase.from("ai_settings").select("mode, provider").eq("id", 1).maybeSingle(),
      context.supabase.from("user_ai_access").select("access").eq("user_id", context.userId).maybeSingle(),
    ]);
    const globalMode = (settings?.mode ?? "standard") as "disabled" | "standard" | "advanced";
    const userAccess = (access?.access ?? "standard") as "disabled" | "standard" | "advanced" | "both";
    if (globalMode === "disabled") throw new Error("Document extraction is currently disabled.");
    if (userAccess === "disabled") throw new Error("Extraction is not enabled for your account.");

    const requested = data.mode ?? "standard";
    const canStandard = userAccess === "standard" || userAccess === "both";
    const canAdvanced = userAccess === "advanced" || userAccess === "both";
    if (requested === "advanced" && (!canAdvanced || globalMode === "standard")) {
      throw new Error("Smart Extract is not enabled for your account.");
    }
    if (requested === "standard" && !canStandard && globalMode !== "advanced") {
      throw new Error("Standard Extract is not enabled for your account.");
    }

    const provider = (settings?.provider ?? null) as "openai" | "gemini" | "claude" | null;

    // ---------- field meta + prompt ----------
    const labelMap = data.labels ?? {};
    const metaByKey = new Map<string, z.infer<typeof FieldMeta>>();
    for (const m of data.fieldsMeta ?? []) metaByKey.set(m.key, m);
    const hasUrdu = (s: string) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
    const inferLang = (key: string, label?: string): string => {
      const k = key.toLowerCase();
      if (/_urdu$|^urdu_|_ur$/.test(k) || (label && hasUrdu(label))) return "urdu";
      if (/_english$|^english_|_en$|_eng$|_roman$|romanized/.test(k)) return "english";
      if (k === "cnic" || k === "phone" || k === "dob" || k === "doi" || /date|number|no$/.test(k)) return "numeric";
      return "auto";
    };
    const fieldList = data.fields.map((k) => {
      const meta = metaByKey.get(k);
      const label = meta?.label ?? labelMap[k] ?? k;
      const lang = meta?.expectedLanguage ?? inferLang(k, label);
      const parts = [`"${k}"`];
      if (label && label !== k) parts.push(`label: ${label}`);
      if (meta?.subtype) parts.push(`type: ${meta.subtype}`);
      parts.push(`language: ${lang}`);
      if (meta?.aiInstruction) parts.push(`rule: ${meta.aiInstruction.replace(/\s+/g, " ").slice(0, 240)}`);
      return parts.join(" | ");
    }).join("\n");

    const regexExtract = (text: string): Record<string, string> => {
      const out: Record<string, string> = {};
      const cnicMatch = text.match(/\b(\d{5})[-\s]?(\d{7})[-\s]?(\d)\b/);
      if (cnicMatch && data.fields.includes("cnic")) out.cnic = `${cnicMatch[1]}-${cnicMatch[2]}-${cnicMatch[3]}`;
      const phoneMatch = text.match(/\b(?:\+?92|0)?[\s-]?3\d{2}[\s-]?\d{7}\b/);
      if (phoneMatch && data.fields.includes("phone")) out.phone = phoneMatch[0].replace(/\s|-/g, "");
      const dobMatch = text.match(/\b([0-3]?\d)[\/\-\.]([01]?\d)[\/\-\.]((?:19|20)\d{2})\b/);
      if (dobMatch && data.fields.includes("dob")) out.dob = `${dobMatch[1].padStart(2, "0")}-${dobMatch[2].padStart(2, "0")}-${dobMatch[3]}`;
      return out;
    };
    const fallback = data.text ? regexExtract(data.text) : {};

    const multi = (data.memberCount ?? 1) > 1;
    const sys =
      "You extract AND localize structured fields from Pakistani ID documents (CNIC, B-Form, passports) " +
      "and from free-form Urdu / English / Roman-Urdu / mixed text or images. " +
      (multi
        ? `Return STRICT JSON: {"members": [ {"values": { <field_key>: <string|null>, ... }}, ... ]} — ONE element per distinct person you can identify in the source (up to ${data.memberCount}). Detect people from CNICs, names, relationships, or "Self/Father/Mother/Brother/Sister/Son/Daughter/Spouse" markers. Do NOT duplicate the same person across slots. Order: head/self first, then father/mother, then siblings/spouse/children. If only one person is present, return a single-element array. `
        : "Return STRICT JSON: {\"values\": { <field_key>: <string|null>, ... }} where each key is the EXACT field key provided. ") +

      "Each field comes with: label, optional subtype, language (urdu|english|roman|numeric|mixed|auto), and an optional rule.\n" +
      "CRITICAL LANGUAGE RULES — follow per-field even if the source is in another script:\n" +
      "  • language=urdu → output MUST be Urdu script (اردو). TRANSLITERATE from English/Roman if needed.\n" +
      "  • language=english → Latin letters only. ROMANIZE from Urdu if needed.\n" +
      "  • language=roman → same as english.\n" +
      "  • language=numeric → digits only in the requested format.\n" +
      "  • language=mixed or auto → keep source script.\n" +
      "If the same underlying value is requested under two fields with different languages, fill BOTH separately.\n" +
      "Fuzzy-match labels semantically across languages.\n" +
      "Format: CNIC → NNNNN-NNNNNNN-N. Dates → DD/MM/YYYY unless rule says otherwise. Phone → digits.\n" +
      "Use null only when genuinely not present. Do not invent. For 'No id card' or similar, set cnic to null." +
      (data.instructions?.trim() ? `\n\n--- TEMPLATE INSTRUCTIONS ---\n${data.instructions.trim()}` : "");

    const userPrompt = multi
      ? `Fields per member (key | label | type | language | rule):\n${fieldList}\n\nReturn ONLY {"members":[{"values":{...}},...]} with up to ${data.memberCount} entries, keyed by the exact field keys. No prose.`
      : `Fields (key | label | type | language | rule):\n${fieldList}\n\nReturn ONLY {"values": {...}} keyed by the exact field key. No prose.`;

    // ---------- call provider ----------
    let values: Record<string, string> = { ...fallback };
    let providerUsed = "lovable";
    let usedMode = requested;

    const callLovable = async () => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("AI is not configured.");
      const userParts: any[] = [{ type: "text", text: userPrompt }];
      if (data.text) userParts.push({ type: "text", text: `\n--- SOURCE TEXT ---\n${data.text}` });
      if (data.image) {
        const url = data.image.startsWith("data:") ? data.image : `data:image/jpeg;base64,${data.image}`;
        userParts.push({ type: "image_url", image_url: { url } });
      }
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: sys }, { role: "user", content: userParts }],
          response_format: { type: "json_object" },
        }),
      });
      if (resp.status === 429) throw new Error("Rate limit hit. Try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted.");
      if (!resp.ok) throw new Error(`Extract failed (${resp.status})`);
      const json: any = await resp.json();
      return json?.choices?.[0]?.message?.content ?? "{}";
    };

    const callOpenAI = async () => {
      const key = await loadProviderKey("openai", context.supabase);
      if (!key) throw new Error("Advanced extraction is not configured.");
      const userParts: any[] = [{ type: "text", text: userPrompt + (data.text ? `\n\nSOURCE:\n${data.text}` : "") }];
      if (data.image) {
        const url = data.image.startsWith("data:") ? data.image : `data:image/jpeg;base64,${data.image}`;
        userParts.push({ type: "image_url", image_url: { url } });
      }
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: sys }, { role: "user", content: userParts }],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) throw new Error(`OpenAI failed (${resp.status})`);
      const json: any = await resp.json();
      return json?.choices?.[0]?.message?.content ?? "{}";
    };

    const callGemini = async () => {
      const key = await loadProviderKey("gemini", context.supabase);
      if (!key) throw new Error("Advanced extraction is not configured.");
      const parts: any[] = [{ text: `${sys}\n\n${userPrompt}${data.text ? `\n\nSOURCE:\n${data.text}` : ""}` }];
      if (data.image) {
        const url = data.image.startsWith("data:") ? data.image : `data:image/jpeg;base64,${data.image}`;
        const [, mime, b64] = url.match(/^data:([^;]+);base64,(.+)$/) ?? [];
        if (mime && b64) parts.push({ inline_data: { mime_type: mime, data: b64 } });
      }
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: "application/json" } }),
      });
      if (!resp.ok) throw new Error(`Gemini failed (${resp.status})`);
      const json: any = await resp.json();
      return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    };

    const callClaude = async () => {
      const key = await loadProviderKey("claude", context.supabase);
      if (!key) throw new Error("Advanced extraction is not configured.");
      const content: any[] = [{ type: "text", text: userPrompt + (data.text ? `\n\nSOURCE:\n${data.text}` : "") }];
      if (data.image) {
        const url = data.image.startsWith("data:") ? data.image : `data:image/jpeg;base64,${data.image}`;
        const [, mime, b64] = url.match(/^data:([^;]+);base64,(.+)$/) ?? [];
        if (mime && b64) content.push({ type: "image", source: { type: "base64", media_type: mime, data: b64 } });
      }
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2000,
          system: sys,
          messages: [{ role: "user", content }],
        }),
      });
      if (!resp.ok) throw new Error(`Claude failed (${resp.status})`);
      const json: any = await resp.json();
      return json?.content?.[0]?.text ?? "{}";
    };

    let members: Array<Record<string, string>> | null = null;
    try {
      let raw = "{}";
      if (requested === "advanced" && provider) {
        providerUsed = provider;
        if (provider === "openai") raw = await callOpenAI();
        else if (provider === "gemini") raw = await callGemini();
        else if (provider === "claude") raw = await callClaude();
      } else {
        usedMode = "standard";
        raw = await callLovable();
      }
      let parsed: any = {};
      try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }
      if (multi && Array.isArray(parsed?.members)) {
        members = [];
        for (const m of parsed.members.slice(0, data.memberCount)) {
          const v = (m?.values ?? m) as Record<string, string | null>;
          const obj: Record<string, string> = {};
          for (const f of data.fields) {
            const x = v?.[f];
            if (x != null && String(x).trim() !== "") obj[f] = String(x);
          }
          members.push(obj);
        }
        // also fill `values` from first member for compatibility
        if (members[0]) values = { ...values, ...members[0] };
      } else {
        const v = (parsed?.values ?? parsed) as Record<string, string | null>;
        for (const f of data.fields) {
          const x = v?.[f];
          if (x != null && String(x).trim() !== "") values[f] = String(x);
        }
      }
    } catch (e) {
      if (Object.keys(fallback).length === 0) throw e;
    }

    // ---------- log usage (best-effort) ----------
    try {
      const inputType = data.image ? "image" : "text";
      const charCount = (data.text?.length ?? 0) + (data.image ? 1500 : 0);
      const tokens = Math.ceil(charCount / 4);
      const cost = usedMode === "advanced" ? tokens * 0.000005 : tokens * 0.000001;
      await context.supabase.from("ai_usage_logs").insert({
        user_id: context.userId,
        entry_id: data.entryId ?? null,
        template_id: data.templateId ?? null,
        mode: usedMode,
        provider: providerUsed,
        input_type: inputType,
        estimated_tokens: tokens,
        estimated_cost: Number(cost.toFixed(4)),
      });
    } catch { /* ignore */ }

    return { values, members, mode: usedMode, provider: providerUsed };
  });
