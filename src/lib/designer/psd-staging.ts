// In-memory PSD handoff between NewTemplateModal and /designer route.
// Survives React Strict Mode double-mount: once consumed, the same payload
// is returned for a short TTL so the second invocation does not see `null`
// and toast "PSD data not found".

export type StagedPsd = {
  width: number;
  height: number;
  background: string | null;
  layers: any[];
};

let staged: StagedPsd | null = null;
let lastConsumed: { payload: StagedPsd; at: number } | null = null;
const CONSUME_TTL_MS = 5000;

export function setStagedPsd(p: StagedPsd) {
  staged = p;
  lastConsumed = null;
}

export function consumeStagedPsd(): StagedPsd | null {
  if (staged) {
    lastConsumed = { payload: staged, at: Date.now() };
    staged = null;
    return lastConsumed.payload;
  }
  if (lastConsumed && Date.now() - lastConsumed.at < CONSUME_TTL_MS) {
    return lastConsumed.payload;
  }
  return null;
}

export function hasStagedPsd() {
  return staged !== null;
}

export function clearStagedPsd() {
  staged = null;
  lastConsumed = null;
}
