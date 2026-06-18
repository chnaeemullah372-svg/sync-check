// User-uploaded fonts that persist locally across refresh / reopen.
// Files are stored in IndexedDB (via idb-keyval) as data URLs and re-injected
// as @font-face rules on every load so both the DOM and the Konva canvas can
// render them. This is independent of the admin Supabase "fonts" table — it
// lets any user add a missing font (e.g. an Urdu Nastaliq face) on the spot.

import { get, set, del, keys } from "idb-keyval";
import { registerCustomFontFamily } from "@/hooks/use-custom-fonts";

const STORE_PREFIX = "userfont:";

export interface UserFontRecord {
  family: string;
  format: string;
  dataUrl: string;
}

const injected = new Set<string>();
let cache: string[] = [];
const listeners = new Set<() => void>();

export function subscribeUserFonts(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getUserFontsSnapshot(): string[] {
  return cache;
}

function emit() {
  cache = [...cache].sort((a, b) => a.localeCompare(b));
  for (const l of listeners) l();
}

function formatFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "otf") return "opentype";
  if (ext === "woff") return "woff";
  if (ext === "woff2") return "woff2";
  return "truetype";
}

function injectFace(family: string, dataUrl: string, format: string) {
  if (injected.has(family)) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-user-font", family);
  style.textContent = `@font-face{font-family:"${family}";src:url("${dataUrl}") format("${format}");font-display:swap;}`;
  document.head.appendChild(style);
  injected.add(family);
  registerCustomFontFamily(family);
  try {
    const face = new FontFace(family, `url(${dataUrl})`);
    face
      .load()
      .then((f) => (document as Document & { fonts: FontFaceSet }).fonts.add(f))
      .catch(() => {
        /* still available via @font-face */
      });
  } catch {
    /* FontFace API not available */
  }
}

export function isUserFontAvailable(family: string) {
  return cache.includes(family);
}

let loadPromise: Promise<void> | null = null;

export function loadUserFontsOnce(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const allKeys = await keys();
      const fontKeys = allKeys.filter(
        (k): k is string => typeof k === "string" && k.startsWith(STORE_PREFIX),
      );
      const fams: string[] = [];
      for (const k of fontKeys) {
        const rec = await get<UserFontRecord>(k);
        if (rec?.family && rec.dataUrl) {
          injectFace(rec.family, rec.dataUrl, rec.format || "truetype");
          fams.push(rec.family);
        }
      }
      cache = fams;
      emit();
    } catch {
      /* IndexedDB unavailable — fonts simply won't persist */
    }
  })();
  return loadPromise;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read font file"));
    r.readAsDataURL(file);
  });
}

const VALID_EXT = /\.(ttf|otf|woff2?|woff)$/i;

export async function addUserFont(file: File): Promise<string> {
  if (!VALID_EXT.test(file.name)) {
    throw new Error("Use a .ttf, .otf, .woff or .woff2 font file");
  }
  const family = file.name.replace(VALID_EXT, "").replace(/[_]+/g, " ").trim() || file.name;
  const format = formatFromName(file.name);
  const dataUrl = await readAsDataUrl(file);
  const rec: UserFontRecord = { family, format, dataUrl };
  await set(STORE_PREFIX + family, rec);
  injectFace(family, dataUrl, format);
  if (!cache.includes(family)) {
    cache = [...cache, family];
    emit();
  }
  try {
    await (document as Document & { fonts: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignore */
  }
  return family;
}

export async function removeUserFont(family: string): Promise<void> {
  await del(STORE_PREFIX + family);
  cache = cache.filter((f) => f !== family);
  injected.delete(family);
  if (typeof document !== "undefined") {
    document.querySelectorAll(`style[data-user-font="${CSS.escape(family)}"]`).forEach((n) => n.remove());
  }
  emit();
}
