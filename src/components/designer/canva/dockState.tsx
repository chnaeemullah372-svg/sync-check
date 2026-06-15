import { createContext, useContext, useState, type ReactNode } from "react";

export type SheetId =
  | "elements"
  | "text"
  | "uploads"
  | "layers"
  | "font"
  | "fontSize"
  | "color"
  | "position"
  | "effects"
  | "align"
  | "aiField"
  | "aiInstructions"
  | "background"
  | "pageSize"
  | null;

interface DockCtx {
  openSheet: SheetId;
  setOpenSheet: (s: SheetId) => void;
}

const Ctx = createContext<DockCtx | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [openSheet, setOpenSheet] = useState<SheetId>(null);
  return <Ctx.Provider value={{ openSheet, setOpenSheet }}>{children}</Ctx.Provider>;
}

export function useDock() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDock must be used inside DockProvider");
  return v;
}
