// In-memory handoff for "Blank Template" image upload between
// NewTemplateModal → /designer route. Same pattern as psd-staging.

export type StagedBlank = {
  src: string;
  width: number;
  height: number;
  fitMode: "auto" | "custom";
};

let staged: StagedBlank | null = null;
let lastConsumed: { payload: StagedBlank; at: number } | null = null;
const CONSUME_TTL_MS = 5000;

export function setStagedBlank(b: StagedBlank) {
  staged = b;
  lastConsumed = null;
}

export function consumeStagedBlank(): StagedBlank | null {
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

export function hasStagedBlank() {
  return staged !== null;
}
