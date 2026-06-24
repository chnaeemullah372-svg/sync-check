import {
  Type, Image as ImageIcon, Square, Minus as MinusIcon, Sparkles,
  Layers as LayersIcon, Palette, MoveHorizontal, AlignLeft, AlignCenter, AlignRight,
  Sliders, Crop, Wand2, Users, Copy, Trash2,
  Replace, Maximize, RectangleVertical, FileText, Edit3, Wrench,
  Bold, Italic, MoreHorizontal,
} from "lucide-react";
import { useDesigner, makeId } from "@/lib/designer/store";
import type { Layer, TextLayer } from "@/lib/designer/types";
import { useDock, type SheetId } from "./dockState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DockButton {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  sheet?: SheetId;
  action?: () => void;
  highlight?: boolean;
  active?: boolean;
  colorSwatch?: string;
  danger?: boolean;
}

export function BottomDock() {
  const { setOpenSheet, toolbarOpen, setToolbarOpen, requestEditText } = useDock();
  const {
    selectedIds, selectedId, layers, addLayer, canvasWidth, canvasHeight,
    deleteLayer, duplicateLayer, updateLayer, groupAsMember,
    ungroupSlot,
  } = useDesigner();

  const selected = selectedId ? layers.find((l) => l.id === selectedId) : null;
  const multi = selectedIds.length > 1;
  const textLayer = selected?.type === "text" ? selected as TextLayer : null;

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

  const toggleBold = () => {
    if (!textLayer || !selectedId) return;
    const cur = textLayer.fontStyle || "normal";
    const hasBold = cur.includes("bold");
    const hasItalic = cur.includes("italic");
    const next = hasItalic ? (hasBold ? "italic" : "bold italic") : (hasBold ? "normal" : "bold");
    updateLayer(selectedId, { fontStyle: next } as any);
  };

  const toggleItalic = () => {
    if (!textLayer || !selectedId) return;
    const cur = textLayer.fontStyle || "normal";
    const hasBold = cur.includes("bold");
    const hasItalic = cur.includes("italic");
    const next = hasBold ? (hasItalic ? "bold" : "bold italic") : (hasItalic ? "normal" : "italic");
    updateLayer(selectedId, { fontStyle: next } as any);
  };

  const cycleAlign = () => {
    if (!textLayer || !selectedId) return;
    const cur = textLayer.align || "left";
    const next = cur === "left" ? "center" : cur === "center" ? "right" : "left";
    updateLayer(selectedId, { align: next } as any);
  };

  const currentAlign = textLayer?.align || "left";
  const AlignIcon = currentAlign === "center" ? AlignCenter : currentAlign === "right" ? AlignRight : AlignLeft;

  let items: DockButton[] = [];

  if (multi) {
    items = [
      { id: "group", label: "Group", icon: Users, action: () => { groupAsMember(); toast.success("Grouped as member"); } },
      { id: "duplicate", label: "Copy", icon: Copy, action: () => selectedIds.forEach((id) => duplicateLayer(id)) },
      { id: "align", label: "Align", icon: AlignLeft, sheet: "align" },
      { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
      { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
      { id: "delete", label: "Delete", icon: Trash2, action: () => selectedIds.forEach((id) => deleteLayer(id)), danger: true },
    ];
  } else if (selected) {
    const slot = selected.slotIndex && selected.slotIndex > 0;

    if (selected.type === "text" && textLayer) {
      const isBold = !!(textLayer.fontStyle?.includes("bold"));
      const isItalic = !!(textLayer.fontStyle?.includes("italic"));
      const fontShortName = (textLayer.fontFamily || "Inter").split(" ").slice(0, 2).join(" ").slice(0, 12);
      const sizeLabel = String(textLayer.fontSize || 18);

      items = [
        { id: "edit", label: "Edit", icon: Edit3, action: () => requestEditText(selected.id) },
        { id: "font", label: fontShortName, sublabel: "Font", icon: Type, sheet: "font" },
        { id: "size", label: sizeLabel, sublabel: "Size", icon: Sliders, sheet: "fontSize" },
        { id: "bold", label: "Bold", icon: Bold, active: isBold, action: toggleBold },
        { id: "italic", label: "Italic", icon: Italic, active: isItalic, action: toggleItalic },
        { id: "color", label: "Color", icon: Palette, sheet: "color", colorSwatch: textLayer.fill },
        { id: "align", label: "Align", icon: AlignIcon, action: cycleAlign },
        { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
        { id: "ai", label: "AI Field", icon: Sparkles, sheet: "aiField", highlight: true },
        { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
        { id: "duplicate", label: "Copy", icon: Copy, action: () => duplicateLayer(selected.id) },
        { id: "delete", label: "Delete", icon: Trash2, action: () => deleteLayer(selected.id), danger: true },
      ];
    } else if (selected.type === "image") {
      items = [
        { id: "replace", label: "Replace", icon: Replace, action: () => triggerImageReplace(selected.id) },
        { id: "crop", label: "Crop/Fit", icon: Crop, sheet: "effects" },
        { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
        { id: "ai", label: "AI Field", icon: Sparkles, sheet: "aiField", highlight: true },
        { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
        { id: "duplicate", label: "Copy", icon: Copy, action: () => duplicateLayer(selected.id) },
        { id: "delete", label: "Delete", icon: Trash2, action: () => deleteLayer(selected.id), danger: true },
      ];
    } else {
      items = [
        { id: "color", label: "Color", icon: Palette, sheet: "color", colorSwatch: (selected as any).fill },
        { id: "position", label: "Position", icon: MoveHorizontal, sheet: "position" },
        { id: "ai", label: "AI Field", icon: Sparkles, sheet: "aiField", highlight: true },
        { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
        { id: "duplicate", label: "Copy", icon: Copy, action: () => duplicateLayer(selected.id) },
        { id: "delete", label: "Delete", icon: Trash2, action: () => deleteLayer(selected.id), danger: true },
      ];
    }

    if (slot) {
      items.unshift({
        id: "ungroup", label: "Ungroup", icon: Users,
        action: () => { ungroupSlot(selected.slotIndex!); toast.success("Ungrouped"); },
      });
    }
  } else {
    items = [
      { id: "tools", label: toolbarOpen ? "Hide" : "Tools", icon: Wrench, action: () => setToolbarOpen(!toolbarOpen), highlight: toolbarOpen },
      { id: "text", label: "Text", icon: Type, action: () => addText("body") },
      { id: "heading", label: "Heading", icon: FileText, action: () => addText("heading") },
      { id: "image", label: "Image", icon: ImageIcon, action: addImage },
      { id: "shape", label: "Shape", icon: Square, action: addBox },
      { id: "line", label: "Line", icon: MinusIcon, action: addLine },
      { id: "uploads", label: "Uploads", icon: ImageIcon, sheet: "uploads" },
      { id: "ai", label: "AI", icon: Wand2, sheet: "aiInstructions", highlight: true },
      { id: "layers", label: "Layers", icon: LayersIcon, sheet: "layers" },
      { id: "background", label: "BG", icon: RectangleVertical, sheet: "background" },
      { id: "size", label: "Page Size", icon: Maximize, sheet: "pageSize" },
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
              "min-w-[64px] px-2 flex flex-col items-center justify-center gap-0.5",
              "hover:bg-accent active:bg-accent/80 transition-colors shrink-0 relative",
              it.highlight && "text-primary",
              it.active && "bg-primary/10 text-primary",
              it.danger && "text-destructive hover:bg-destructive/10",
            )}
          >
            <div className="relative">
              {it.colorSwatch ? (
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background shadow-sm"
                    style={{ background: it.colorSwatch }}
                  />
                </div>
              ) : (
                <Icon className={cn("h-5 w-5", (it.highlight || it.active) && "text-primary", it.danger && "text-destructive")} />
              )}
            </div>
            <span className={cn(
              "leading-none text-center w-full truncate",
              it.sublabel ? "text-[11px] font-semibold" : "text-[10px]",
            )}>
              {it.label}
            </span>
            {it.sublabel && (
              <span className="text-[9px] text-muted-foreground leading-none">{it.sublabel}</span>
            )}
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
