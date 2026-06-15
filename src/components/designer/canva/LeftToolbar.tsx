import { MousePointer2, Square, PaintBucket, Pipette, X } from "lucide-react";
import { useDock, type ToolId } from "./dockState";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolId; label: string; icon: React.ComponentType<{ className?: string }>; shortcut?: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "rect", label: "Box", icon: Square, shortcut: "R" },
  { id: "fill", label: "Fill", icon: PaintBucket, shortcut: "G" },
  { id: "eyedropper", label: "Pick", icon: Pipette, shortcut: "I" },
];

export function LeftToolbar() {
  const { activeTool, setActiveTool, toolColor, setToolColor, setOpenSheet } = useDock();
  return (
    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-card border rounded-xl shadow-lg p-1.5">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""}`}
            className={cn(
              "h-10 w-10 grid place-items-center rounded-lg transition-colors",
              active ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
      <div className="h-px bg-border my-1" />
      <button
        onClick={() => setOpenSheet("color")}
        title="Tool color"
        className="h-10 w-10 grid place-items-center rounded-lg border-2 border-border hover:border-primary transition-colors"
        style={{ background: toolColor }}
      >
        <input
          type="color"
          value={toolColor}
          onChange={(e) => setToolColor(e.target.value)}
          className="absolute opacity-0 w-10 h-10 cursor-pointer"
          aria-label="Pick color"
        />
      </button>
    </div>
  );
}
