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

export type ToolId = "select" | "rect" | "fill" | "eyedropper";

interface DockCtx {
  openSheet: SheetId;
  setOpenSheet: (s: SheetId) => void;
  activeTool: ToolId;
  setActiveTool: (t: ToolId) => void;
  toolColor: string;
  setToolColor: (c: string) => void;
}

const Ctx = createContext<DockCtx | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [openSheet, setOpenSheet] = useState<SheetId>(null);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [toolColor, setToolColor] = useState<string>("#3B82F6");
  return (
    <Ctx.Provider value={{ openSheet, setOpenSheet, activeTool, setActiveTool, toolColor, setToolColor }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDock() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDock must be used inside DockProvider");
  return v;
}
