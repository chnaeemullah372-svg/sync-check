// PSD handoff between NewTemplateModal and /designer route.
// Keep an in-memory fast path, but also persist to IndexedDB so the import
// survives route reloads / branch sync refreshes where module memory is lost.

import { del, get, set } from "idb-keyval";

export type StagedPsd = {
  width: number;
  height: number;
  background: string | null;
  layers: any[];
};

let staged: StagedPsd | null = null;
let lastConsumed: { payload: StagedPsd; at: number } | null = null;
const CONSUME_TTL_MS = 5000;
const PERSIST_KEY = "designer:psdImport:v1";
const LEGACY_SESSION_KEY = "designer.psdImport";
const PERSIST_TTL_MS = 1000 * 60 * 15;

type StoredPsd = StagedPsd & { createdAt: number };

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export async function setStagedPsd(p: StagedPsd) {
  staged = p;
  lastConsumed = null;
  if (!canUseBrowserStorage()) return;
  const stored: StoredPsd = { ...p, createdAt: Date.now() };
  try {
    await set(PERSIST_KEY, stored);
  } catch {
    /* In-memory staging still works if browser storage quota is full. */
  }
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function consumeStagedPsd(): Promise<StagedPsd | null> {
  if (staged) {
    lastConsumed = { payload: staged, at: Date.now() };
    staged = null;
    return lastConsumed.payload;
  }
  if (lastConsumed && Date.now() - lastConsumed.at < CONSUME_TTL_MS) {
    return lastConsumed.payload;
  }
  if (!canUseBrowserStorage()) return null;
  try {
    const persisted = await get<StoredPsd>(PERSIST_KEY);
    if (persisted && Date.now() - persisted.createdAt <= PERSIST_TTL_MS) {
      const payload: StagedPsd = {
        width: persisted.width,
        height: persisted.height,
        background: persisted.background,
        layers: persisted.layers,
      };
      lastConsumed = { payload, at: Date.now() };
      return payload;
    }
    if (persisted) void del(PERSIST_KEY);
  } catch {
    /* fall through to legacy sessionStorage */
  }
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (raw) {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      const payload = JSON.parse(raw) as StagedPsd;
      lastConsumed = { payload, at: Date.now() };
      return payload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function hasStagedPsd() {
  return staged !== null;
}

export function clearStagedPsd() {
  staged = null;
  lastConsumed = null;
  if (!canUseBrowserStorage()) return;
  void del(PERSIST_KEY);
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
