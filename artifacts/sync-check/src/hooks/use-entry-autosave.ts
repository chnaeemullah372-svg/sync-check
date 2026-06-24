import { useEffect, useRef } from "react";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

const keyOf = (entryId: string) => `entry.autosave.${entryId}`;

export interface EntryAutosavePayload {
  formData: any;
  imagesMeta?: Record<string, unknown>;
  savedAt?: number;
}

/**
 * IndexedDB-backed autosave for the entry editor.
 * Calls `onServerSave(payload)` debounced 800ms (in addition to IDB write).
 */
export function useEntryAutosave(
  entryId: string | undefined,
  state: EntryAutosavePayload,
  onServerSave?: (p: EntryAutosavePayload) => void,
) {
  const stateRef = useRef(state);
  const onServerRef = useRef(onServerSave);
  useEffect(() => {
    stateRef.current = state;
    onServerRef.current = onServerSave;
  });

  useEffect(() => {
    if (!entryId) return;
    const t = setTimeout(() => {
      const payload = { ...stateRef.current, savedAt: Date.now() };
      idbSet(keyOf(entryId), payload).catch(() => {});
      onServerRef.current?.(payload);
    }, 800);
    return () => clearTimeout(t);
  }, [entryId, state]);
}

export async function loadEntryAutosaveLocal(
  entryId: string,
): Promise<EntryAutosavePayload | null> {
  try {
    const p = await idbGet<EntryAutosavePayload>(keyOf(entryId));
    return p ?? null;
  } catch {
    return null;
  }
}

export function clearEntryAutosave(entryId: string) {
  idbDel(keyOf(entryId)).catch(() => {});
}
