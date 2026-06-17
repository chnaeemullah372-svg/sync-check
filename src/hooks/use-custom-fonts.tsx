// Loads admin-uploaded fonts from the `fonts` table + private `fonts` bucket
// and injects them as @font-face rules so every component (Konva canvas
// included) renders them. Also exposes a module-level registry so the PSD
// import resolver can mark these families as "available" — preventing the
// fallback warning for fonts the admin has actually uploaded.

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomFontRow {
  id: string;
  name: string;
  family: string;
  file_path: string;
  format: string;
  aliases: string[];
  language: string | null;
}

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

const loaded = new Set<string>();
/** All registered custom font families (lowercased, no spaces/punct). */
const registry = new Set<string>();
const families = new Set<string>();
const aliasToFamily = new Map<string, string>();

function normalizeKey(s: string) {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

export function isCustomFontAvailable(family: string) {
  return registry.has(normalizeKey(family));
}

export function resolveCustomFontFamily(family: string) {
  return aliasToFamily.get(normalizeKey(family)) ?? null;
}

export function listCustomFontFamilies() {
  return Array.from(families);
}

async function injectFont(row: CustomFontRow) {
  if (loaded.has(row.family)) return;
  const { data, error } = await supabase.storage
    .from("fonts")
    .createSignedUrl(row.file_path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return;

  const fmt = row.format || "truetype";
  const css = `@font-face { font-family: "${row.family}"; src: url("${data.signedUrl}") format("${fmt}"); font-display: swap; }`;
  const style = document.createElement("style");
  style.setAttribute("data-custom-font", row.family);
  style.textContent = css;
  document.head.appendChild(style);
  loaded.add(row.family);
  families.add(row.family);
  registry.add(normalizeKey(row.family));
  aliasToFamily.set(normalizeKey(row.family), row.family);
  // Also register declared aliases so PSD font names like "MyriadArabic"
  // resolve to this uploaded font.
  for (const a of row.aliases || []) {
    registry.add(normalizeKey(a));
    aliasToFamily.set(normalizeKey(a), row.family);
  }

  // Force-load via FontFace API so Konva text uses the real font on first paint.
  try {
    const face = new FontFace(row.family, `url(${data.signedUrl})`);
    const loadedFace = await face.load();
    (document as Document & { fonts: FontFaceSet }).fonts.add(loadedFace);
  } catch {
    /* font will still load via @font-face */
  }
}

export function useCustomFonts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("fonts")
        .select("id,name,family,file_path,format,aliases,language");
      if (cancelled || error || !data) return;
      for (const row of data as CustomFontRow[]) await injectFont(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
