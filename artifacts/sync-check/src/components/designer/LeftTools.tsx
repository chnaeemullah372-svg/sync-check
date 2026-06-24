import { useRef } from "react";
import { useDesigner, makeId } from "@/lib/designer/store";
import type { Layer, ImageSubtype } from "@/lib/designer/types";
import {
  MousePointer2, Type, Image as ImageIcon, Square, Minus, Upload,
  Fingerprint, PenLine, Sticker,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ToolBtn({
  onClick, title, active, children,
}: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "h-9 w-9 flex items-center justify-center rounded border border-transparent",
        "hover:bg-accent hover:border-border transition",
        active && "bg-accent border-border",
      )}
    >
      {children}
    </button>
  );
}

export function LeftTools({ className }: { className?: string }) {
  const { addLayer, setBackground, selectLayer } = useDesigner();
  const bgRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);

  const addText = () => addLayer({
    id: makeId(), name: "Text", type: "text",
    x: 60, y: 60, width: 240, height: 40,
    rotation: 0, opacity: 1, visible: true, locked: false,
    text: "Double-click to edit", fontSize: 24, fontFamily: "Arial",
    fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "",
  } as Layer);

  const addImg = (subtype: ImageSubtype, name: string, w: number, h: number, fk: string) =>
    addLayer({
      id: makeId(), name, type: "image",
      x: 80, y: 80, width: w, height: h,
      rotation: 0, opacity: 1, visible: true, locked: false,
      src: null, fit: "crop", subtype, fieldKey: fk as any,
    } as Layer);

  const addBox = () => addLayer({
    id: makeId(), name: "Box", type: "box",
    x: 100, y: 100, width: 180, height: 120,
    rotation: 0, opacity: 1, visible: true, locked: false,
    fill: "transparent", stroke: "#3b82f6", strokeWidth: 2,
  } as Layer);

  const addLine = () => addLayer({
    id: makeId(), name: "Line", type: "line",
    x: 80, y: 200, width: 240, height: 2,
    rotation: 0, opacity: 1, visible: true, locked: false,
    stroke: "#111827", strokeWidth: 2,
  } as Layer);

  const handleBg = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      const img = new window.Image();
      img.onload = () => setBackground({ src: url, width: img.width, height: img.height });
      img.src = url;
    };
    r.readAsDataURL(file);
  };

  const handleAsset = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      const img = new window.Image();
      img.onload = () => {
        const s = Math.min(1, 220 / img.width);
        addLayer({
          id: makeId(), name: file.name.replace(/\.[^.]+$/, ""), type: "image",
          x: 100, y: 100, width: img.width * s, height: img.height * s,
          rotation: 0, opacity: 1, visible: true, locked: false,
          src: url, fit: "fit", subtype: "asset", fieldKey: "",
        } as Layer);
      };
      img.src = url;
    };
    r.readAsDataURL(file);
  };

  return (
    <aside className={cn("bg-card border-r flex flex-col items-center gap-1 py-2 px-1 w-12 shrink-0", className)}>
      <input ref={bgRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleBg(e.target.files[0])} />
      <input ref={assetRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleAsset(e.target.files[0])} />

      <ToolBtn onClick={() => selectLayer(null)} title="Select / Deselect">
        <MousePointer2 className="w-4 h-4" />
      </ToolBtn>
      <div className="h-px w-6 bg-border my-1" />
      <ToolBtn onClick={addText} title="Add Text">
        <Type className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => addImg("photo", "Photo Box", 160, 200, "photo")} title="Photo box">
        <ImageIcon className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => addImg("thumb", "Thumb Box", 120, 120, "thumb")} title="Thumb box">
        <Fingerprint className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => addImg("signature", "Signature Box", 200, 80, "signature")} title="Signature box">
        <PenLine className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={addBox} title="Box / Border">
        <Square className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={addLine} title="Line">
        <Minus className="w-4 h-4" />
      </ToolBtn>
      <div className="h-px w-6 bg-border my-1" />
      <ToolBtn onClick={() => assetRef.current?.click()} title="Upload asset (logo/stamp)">
        <Sticker className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={() => bgRef.current?.click()} title="Set background">
        <Upload className="w-4 h-4" />
      </ToolBtn>
    </aside>
  );
}
