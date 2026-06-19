// User-uploaded fonts that persist locally across refresh / reopen.
// Files are stored in IndexedDB as data URLs and re-injected as @font-face
// rules so both DOM text and Konva canvas text can use them immediately.

import { del, get, keys, set } from "idb-keyval";
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
let loadPromise: Promise<void> | null = null;

export function subscribeUserFonts(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getUserFontsSnapshot(): string[] {
  return cache;
}

function emit() {
  cache = [...cache].sort((a, b) => a.localeCompare(b));
  listeners.forEach((listener) => listener());
}

function formatFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "otf") return "opentype";
  if (ext === "woff") return "woff";
  if (ext === "woff2") return "woff2";
  return "truetype";
}

function injectFace(family: string, dataUrl: string, format: string) {
  registerCustomFontFamily(family);
  if (typeof document === "undefined" || injected.has(family)) return;

  const style = document.createElement("style");
  style.setAttribute("data-user-font", family);
  style.textContent = `@font-face{font-family:"${family}";src:url("${dataUrl}") format("${format}");font-display:swap;}`;
  document.head.appendChild(style);
  injected.add(family);

  try {
    const face = new FontFace(family, `url(${dataUrl})`);
    face
      .load()
      .then((loadedFace) => (document as Document & { fonts: FontFaceSet }).fonts.add(loadedFace))
      .catch(() => {
        /* font will still load via @font-face */
      });
  } catch {
    /* FontFace API unavailable */
  }
}

export function loadUserFontsOnce(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const allKeys = await keys();
      const fontKeys = allKeys.filter(
        (key): key is string => typeof key === "string" && key.startsWith(STORE_PREFIX),
      );
      const families: string[] = [];
      for (const key of fontKeys) {
        const record = await get<UserFontRecord>(key);
        if (record?.family && record.dataUrl) {
          injectFace(record.family, record.dataUrl, record.format || "truetype");
          families.push(record.family);
        }
      }
      cache = families;
      emit();
    } catch {
      /* IndexedDB unavailable — uploaded fonts simply won't persist */
    }
  })();
  return loadPromise;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read font file"));
    reader.readAsDataURL(file);
  });
}

const VALID_EXT = /\.(ttf|otf|woff2?|woff)$/i;

export async function addUserFont(file: File): Promise<string> {
  if (!VALID_EXT.test(file.name)) {
    throw new Error("Use a .ttf, .otf, .woff or .woff2 font file");
  }
  const family = file.name.replace(VALID_EXT, "").replace(/[_-]+/g, " ").trim() || file.name;
  const format = formatFromName(file.name);
  const dataUrl = await readAsDataUrl(file);
  await set(STORE_PREFIX + family, { family, format, dataUrl } satisfies UserFontRecord);
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
  cache = cache.filter((font) => font !== family);
  injected.delete(family);
  if (typeof document !== "undefined") {
    document.querySelectorAll(`style[data-user-font="${CSS.escape(family)}"]`).forEach((node) => node.remove());
  }
  emit();
}