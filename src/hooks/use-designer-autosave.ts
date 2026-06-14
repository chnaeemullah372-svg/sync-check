import { useEffect } from "react";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { useDesigner } from "@/lib/designer/store";

const AUTOSAVE_KEY = "designer.autosave.v2";
// legacy localStorage key (small payloads only) — used as fallback for older sessions
const LEGACY_LS_KEY = "designer.autosave";

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
        let p: any = await idbGet(AUTOSAVE_KEY);
        if (!p) {
          // try legacy localStorage payload
          const raw = localStorage.getItem(LEGACY_LS_KEY);
          if (raw) p = JSON.parse(raw);
        }
        if (cancelled || !p || typeof p !== "object") return;
        const hasContent =
          (Array.isArray(p.layers) && p.layers.length > 0) || p.background?.src;
        if (!hasContent) return;
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
    const unsub = useDesigner.subscribe((s) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const payload = {
          background: s.background,
          canvasWidth: s.canvasWidth,
          canvasHeight: s.canvasHeight,
          layers: s.layers,
          memberNames: s.memberNames,
          savedAt: Date.now(),
        };
        idbSet(AUTOSAVE_KEY, payload).catch((e) =>
          console.warn("Autosave write failed", e),
        );
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
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
