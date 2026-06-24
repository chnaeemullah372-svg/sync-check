import { useEffect } from "react";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { useDesigner } from "@/lib/designer/store";

const AUTOSAVE_KEY = "designer.autosave.v2";
// legacy localStorage key (small payloads only) — used as fallback for older sessions
const LEGACY_LS_KEY = "designer.autosave";

async function readAutosavePayload() {
  let p: any = await idbGet(AUTOSAVE_KEY);
  if (!p) {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (raw) p = JSON.parse(raw);
  }
  if (!p || typeof p !== "object") return null;
  const hasContent =
    (Array.isArray(p.layers) && p.layers.length > 0) || p.background?.src;
  return hasContent ? p : null;
}

export async function getDesignerAutosaveSnapshot() {
  try {
    return await readAutosavePayload();
  } catch (e) {
    console.warn("Autosave read failed", e);
    return null;
  }
}

/**
 * Persist the designer state to IndexedDB on every change so a refresh
 * (or accidental tab close) does not wipe in-progress work, even when the
 * background is a large data-URL that would blow the localStorage quota.
 */
export function useDesignerAutosave(opts: { skipHydrate?: boolean } = {}) {
  const loadState = useDesigner((s) => s.loadState);
  const skipHydrate = opts.skipHydrate ?? false;

  // hydrate once on mount
  useEffect(() => {
    if (skipHydrate) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await readAutosavePayload();
        if (cancelled || !p || typeof p !== "object") return;
        loadState({
          background: p.background,
          canvasWidth: p.canvasWidth,
          canvasHeight: p.canvasHeight,
          layers: p.layers,
          memberNames: p.memberNames || {},
        });
      } catch (e) {
        console.warn("Autosave hydrate failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipHydrate]);

  // subscribe & debounce-save to IndexedDB
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latestPayload: {
      background: unknown;
      canvasWidth: number;
      canvasHeight: number;
      layers: unknown[];
      memberNames: Record<number, string>;
      savedAt: number;
    } | null = null;
    const writeNow = () => {
      if (!latestPayload) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      idbSet(AUTOSAVE_KEY, latestPayload).catch((e) =>
        console.warn("Autosave write failed", e),
      );
    };
    const unsub = useDesigner.subscribe((s) => {
      if (timer) clearTimeout(timer);
      latestPayload = {
        background: s.background,
        canvasWidth: s.canvasWidth,
        canvasHeight: s.canvasHeight,
        layers: s.layers,
        memberNames: s.memberNames,
        savedAt: Date.now(),
      };
      timer = setTimeout(() => {
        writeNow();
      }, 150);
    });
    const onPageHidden = () => {
      if (document.visibilityState === "hidden") writeNow();
    };
    window.addEventListener("pagehide", writeNow);
    window.addEventListener("beforeunload", writeNow);
    document.addEventListener("visibilitychange", onPageHidden);
    return () => {
      writeNow();
      window.removeEventListener("pagehide", writeNow);
      window.removeEventListener("beforeunload", writeNow);
      document.removeEventListener("visibilitychange", onPageHidden);
      unsub();
    };
  }, []);
}

export function clearDesignerAutosave() {
  idbDel(AUTOSAVE_KEY).catch(() => {});
  try {
    localStorage.removeItem(LEGACY_LS_KEY);
  } catch {
    /* ignore */
  }
}
