// In-memory handoff for "Blank Template" image upload between
// NewTemplateModal → /designer route. Same pattern as psd-staging.

export type StagedBlank = {
  src: string;
  width: number;
  height: number;
  fitMode: "auto" | "custom";
};

let staged: StagedBlank | null = null;

export function setStagedBlank(b: StagedBlank) {
  staged = b;
}

export function consumeStagedBlank(): StagedBlank | null {
  const b = staged;
  staged = null;
  return b;
}

export function hasStagedBlank() {
  return staged !== null;
}
