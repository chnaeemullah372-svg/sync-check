// In-memory PSD handoff between NewTemplateModal and /designer route.
// Avoids sessionStorage (5MB) and IndexedDB structured-clone quotas entirely.
// Lives only for the SPA session — that's all we need for navigation.

export type StagedPsd = {
  width: number;
  height: number;
  background: string | null;
  layers: any[];
};

let staged: StagedPsd | null = null;

export function setStagedPsd(p: StagedPsd) {
  staged = p;
}

export function consumeStagedPsd(): StagedPsd | null {
  const p = staged;
  staged = null;
  return p;
}

export function hasStagedPsd() {
  return staged !== null;
}
