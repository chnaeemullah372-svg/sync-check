import {
  Type, Image as ImageIcon, Square, Minus as MinusIcon, Sparkles,
  Layers as LayersIcon, Palette, MoveHorizontal, AlignLeft, Sliders, Crop,
  Wand2, Users, Copy, Trash2,
  Replace, Maximize, RectangleVertical, FileText, Edit3, Wrench,
} from "lucide-react";
import { useDesigner, makeId } from "@/lib/designer/store";
import type { Layer } from "@/lib/designer/types";
import { useDock, type SheetId } from "./dockState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DockButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sheet?: SheetId;
  action?: () => void;
  highlight?: boolean;
}

export function BottomDock() {
  const { setOpenSheet } = useDock();
  const {
    selectedIds, selectedId, layers, addLayer, canvasWidth, canvasHeight,
    deleteLayer, duplicateLayer, updateLayer, groupAsMember,
    ungroupSlot, deleteSlot, selectLayer,
  } = useDesigner();

  const selected = selectedId ? layers.find((l) => l.id === selectedId) : null;
  const multi = selectedIds.length > 1;

  // Helpers
  const center = { x: canvasWidth / 2 - 100, y: canvasHeight / 2 - 30 };

  const addText = (style: "heading" | "body" | "small" = "body") => {
    addLayer({
      id: makeId(),
      name: style === "heading" ? "Heading" : style === "body" ? "Text" : "Small",
      type: "text",
      x: center.x, y: center.y,
      width: 240, height: style === "heading" ? 50 : 30,
      rotation: 0, opacity: 1, visible: true, locked: false,
      text: style === "heading" ? "Add a heading" : "Add a line of text",
      fontSize: style === "heading" ? 32 : style === "body" ? 18 : 12,
      fontFamily: "Inter", fontStyle: style === "heading" ? "bold" : "normal",
      fill: "#111827", align: "left",
    } as Layer);
  };

  const addBox = () => {
    addLayer({
      id: makeId(), name: "Rectangle", type: "box",
      x: center.x, y: center.y, width: 200, height: 120,
      rotation: 0, opacity: 1, visible: true, locked: false,
      fill: "#3B82F6", stroke: "#1E40AF", strokeWidth: 0,
    } as Layer);
  };

  const addLine = () => {
    addLayer({
      id: makeId(), name: "Line", type: "line",
      x: center.x, y: center.y + 30, width: 240, height: 2,
      rotation: 0, opacity: 1, visible: true, locked: false,
      stroke: "#111827", strokeWidth: 2,
    } as Layer);
  };

  const addImage = () => {
    addLayer({
      id: makeId(), name: "Image Box", type: "image",
      x: center.x, y: center.y, width: 220, height: 220,
      rotation: 0, opacity: 1, visible: true, locked: false,
      src: null, fit: "crop", subtype: "asset",
    } as Layer);
  };

  // Decide which items to show based on context
  let items: DockButton[] = [];

  if (multi) {
    items = [
      { id: "group", label: "Group", icon: Users, action: () => { groupAsMember(); toast.success("Grouped as member"); } },
      { id: "duplicate", label: "Duplicate", icon: Copy, action: () => selectedIds.forEach((id) => duplicateLayer(id)) },
      { id: "delete", label: "Delete", icon: Trash2, action: () => selectedIds.forEach((id) => deleteLayer(id)) },
      { id: "align", label: "Align", icon: AlignLeft, sheet: "align" },
      { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
    ];
  } else if (selected) {
    const slot = selected.slotIndex && selected.slotIndex > 0;
    if (selected.type === "text") {
      items = [
        { id: "edit", label: "Edit", icon: Edit3, action: () => {
          const t = prompt("Edit text", (selected as any).text || "");
          if (t !== null) updateLayer(selected.id, { text: t } as any);
        } },
        { id: "font", label: "Font", icon: Type, sheet: "font" },
        { id: "size", label: "Size", icon: Sliders, sheet: "fontSize" },
        { id: "color", label: "Color", icon: Palette, sheet: "color" },
        { id: "align", label: "Align", icon: AlignLeft, sheet: "align" },
        { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
        { id: "ai", label: "AI Field", icon: Sparkles, sheet: "aiField", highlight: true },
        { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
        { id: "duplicate", label: "Duplicate", icon: Copy, action: () => duplicateLayer(selected.id) },
        { id: "delete", label: "Delete", icon: Trash2, action: () => deleteLayer(selected.id) },
      ];
    } else if (selected.type === "image") {
      items = [
        { id: "replace", label: "Replace", icon: Replace, action: () => triggerImageReplace(selected.id) },
        { id: "crop", label: "Crop", icon: Crop, sheet: "effects" },
        { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
        { id: "ai", label: "AI Field", icon: Sparkles, sheet: "aiField", highlight: true },
        { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
        { id: "duplicate", label: "Duplicate", icon: Copy, action: () => duplicateLayer(selected.id) },
        { id: "delete", label: "Delete", icon: Trash2, action: () => deleteLayer(selected.id) },
      ];
    } else {
      items = [
        { id: "color", label: "Color", icon: Palette, sheet: "color" },
        { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
        { id: "ai", label: "AI Field", icon: Sparkles, sheet: "aiField", highlight: true },
        { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
        { id: "duplicate", label: "Duplicate", icon: Copy, action: () => duplicateLayer(selected.id) },
        { id: "delete", label: "Delete", icon: Trash2, action: () => deleteLayer(selected.id) },
      ];
    }
    if (slot) {
      items.unshift({
        id: "ungroup", label: "Ungroup", icon: Users,
        action: () => { ungroupSlot(selected.slotIndex!); toast.success("Ungrouped"); },
      });
    }
  } else {
    // Nothing selected
    items = [
      { id: "text", label: "Text", icon: Type, action: () => addText("body") },
      { id: "heading", label: "Heading", icon: FileText, action: () => addText("heading") },
      { id: "image", label: "Image", icon: ImageIcon, action: addImage },
      { id: "shape", label: "Shape", icon: Square, action: addBox },
      { id: "line", label: "Line", icon: MinusIcon, action: addLine },
      { id: "uploads", label: "Uploads", icon: ImageIcon, sheet: "uploads" },
      { id: "ai", label: "AI", icon: Wand2, sheet: "aiInstructions", highlight: true },
      { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
      { id: "background", label: "Background", icon: RectangleVertical, sheet: "background" },
      { id: "size", label: "Size", icon: Maximize, sheet: "pageSize" },
    ];
  }

  return (
    <div className="h-16 shrink-0 border-t bg-card flex items-stretch overflow-x-auto no-scrollbar">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => {
              if (it.action) it.action();
              else if (it.sheet) setOpenSheet(it.sheet);
            }}
            className={cn(
              "min-w-[68px] px-2 flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium",
              "hover:bg-accent active:bg-accent/80 transition-colors shrink-0",
              it.highlight && "text-primary",
            )}
          >
            <Icon className={cn("h-5 w-5", it.highlight && "text-primary")} />
            <span className="leading-none">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function triggerImageReplace(layerId: string) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      useDesigner.getState().updateLayer(layerId, { src: String(r.result) } as any);
      toast.success("Image replaced");
    };
    r.readAsDataURL(f);
  };
  input.click();
}
