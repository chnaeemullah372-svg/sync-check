import { useState } from "react";
import { CanvaSheet } from "./Sheet";
import { useDock } from "./dockState";
import { useDesigner, makeId } from "@/lib/designer/store";
import type { TextLayer } from "@/lib/designer/types";

import { FONT_LIBRARY, FONT_CATEGORIES, DEFAULT_COLORS } from "@/lib/designer/fonts";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline as UnderlineIcon,
  Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Layers as LayersIcon, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function FontSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedIds, updateLayer } = useDesigner();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const textLayers = selectedIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is TextLayer => !!l && l.type === "text");
  const current = textLayers[0]?.fontFamily;
  const fonts = FONT_LIBRARY.filter(
    (f) => (cat === "all" || f.category === cat) &&
           (q.trim() === "" || f.label.toLowerCase().includes(q.toLowerCase()) || f.family.toLowerCase().includes(q.toLowerCase())),
  );
  const apply = (family: string, rtl?: boolean) => {
    textLayers.forEach((l) => updateLayer(l.id, { fontFamily: family, rtl } as any));
  };
  return (
    <CanvaSheet open={openSheet === "font"} onClose={() => setOpenSheet(null)} title="Font" height="65vh">
      <div className="p-3 space-y-3">
        <Input placeholder="Search fonts…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
          <button onClick={() => setCat("all")}
            className={cn("px-3 h-7 rounded-full text-[11px] font-medium shrink-0",
              cat === "all" ? "bg-primary text-primary-foreground" : "bg-muted")}>All</button>
          {FONT_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("px-3 h-7 rounded-full text-[11px] font-medium shrink-0",
                cat === c.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          {fonts.map((f) => {
            const sel = current === f.family;
            return (
              <button key={f.family} onClick={() => apply(f.family, f.rtl)}
                className={cn("w-full text-left px-3 py-3 rounded-lg border flex items-center justify-between gap-3",
                  sel ? "border-primary bg-primary/5" : "hover:bg-accent border-transparent")}>
                <span className="truncate text-xl" style={{ fontFamily: f.family, direction: f.rtl ? "rtl" : "ltr" }}>
                  {f.preview || f.label}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{f.category}</span>
              </button>
            );
          })}
        </div>
      </div>
    </CanvaSheet>
  );
}

export function FontSizeSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedIds, updateLayer } = useDesigner();
  const textLayers = selectedIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is TextLayer => !!l && l.type === "text");
  const size = textLayers[0]?.fontSize ?? 18;
  const set = (v: number) => textLayers.forEach((l) => updateLayer(l.id, { fontSize: v } as any));
  return (
    <CanvaSheet open={openSheet === "fontSize"} onClose={() => setOpenSheet(null)} title="Font size" height="38vh">
      <div className="p-4 space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => set(Math.max(6, size - 1))}>−</Button>
          <Input type="number" value={size} min={6} max={400}
            onChange={(e) => set(Math.max(6, Math.min(400, +e.target.value || size)))}
            className="text-center h-10 text-lg font-bold" />
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => set(Math.min(400, size + 1))}>+</Button>
        </div>
        <Slider value={[size]} min={6} max={200} step={1} onValueChange={(v) => set(v[0])} />
        <div className="flex flex-wrap gap-1.5">
          {[10, 12, 14, 16, 18, 24, 32, 48, 64, 96].map((n) => (
            <button key={n} onClick={() => set(n)}
              className={cn("h-9 min-w-[44px] px-2 rounded-md border text-sm font-medium",
                size === n ? "border-primary bg-primary/5" : "hover:bg-accent")}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </CanvaSheet>
  );
}

export function ColorSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedIds, updateLayer } = useDesigner();
  const sels = selectedIds.map((id) => layers.find((l) => l.id === id)).filter(Boolean) as any[];
  const current: string = sels[0]?.fill ?? sels[0]?.stroke ?? "#000000";
  const apply = (c: string) => {
    sels.forEach((l) => {
      if (l.type === "text" || l.type === "box") updateLayer(l.id, { fill: c });
      else if (l.type === "line") updateLayer(l.id, { stroke: c });
    });
  };
  return (
    <CanvaSheet open={openSheet === "color"} onClose={() => setOpenSheet(null)} title="Color" height="45vh">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-8 gap-2">
          {DEFAULT_COLORS.map((c) => (
            <button key={c} onClick={() => apply(c)}
              className={cn("aspect-square rounded-lg border-2",
                current.toUpperCase() === c.toUpperCase() ? "border-primary ring-2 ring-primary/30" : "border-border")}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={current} onChange={(e) => apply(e.target.value)}
            className="h-10 w-12 rounded border cursor-pointer" />
          <Input value={current} onChange={(e) => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && apply(e.target.value)} />
        </div>
      </div>
    </CanvaSheet>
  );
}

export function PositionSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedId, updateLayer, moveLayer } = useDesigner();
  const l = selectedId ? layers.find((x) => x.id === selectedId) : null;
  if (!l) return <CanvaSheet open={openSheet === "position"} onClose={() => setOpenSheet(null)} title="Position"><div className="p-4 text-sm text-muted-foreground">Select a layer first.</div></CanvaSheet>;
  return (
    <CanvaSheet open={openSheet === "position"} onClose={() => setOpenSheet(null)} title="Position & size" height="55vh">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="X" value={Math.round(l.x)} onChange={(v) => updateLayer(l.id, { x: v })} />
          <Field label="Y" value={Math.round(l.y)} onChange={(v) => updateLayer(l.id, { y: v })} />
          <Field label="W" value={Math.round(l.width)} onChange={(v) => updateLayer(l.id, { width: Math.max(5, v) })} />
          <Field label="H" value={Math.round(l.height)} onChange={(v) => updateLayer(l.id, { height: Math.max(5, v) })} />
          <Field label="Rotation" value={Math.round(l.rotation)} onChange={(v) => updateLayer(l.id, { rotation: v })} suffix="°" />
          <Field label="Opacity %" value={Math.round(l.opacity * 100)} onChange={(v) => updateLayer(l.id, { opacity: Math.max(0, Math.min(1, v / 100)) })} />
        </div>
        <div className="border-t pt-3">
          <div className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Layer order</div>
          <div className="grid grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => moveLayer(l.id, "front")}>Front</Button>
            <Button variant="outline" size="sm" onClick={() => moveLayer(l.id, "up")}>Up</Button>
            <Button variant="outline" size="sm" onClick={() => moveLayer(l.id, "down")}>Down</Button>
            <Button variant="outline" size="sm" onClick={() => moveLayer(l.id, "back")}>Back</Button>
          </div>
        </div>
      </div>
    </CanvaSheet>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase">{label}</span>
      <div className="flex items-center gap-1 mt-1">
        <Input type="number" value={value} onChange={(e) => onChange(+e.target.value || 0)} className="h-10" />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

export function AlignSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedIds, updateLayer } = useDesigner();
  const sels = selectedIds.map((id) => layers.find((l) => l.id === id)).filter(Boolean) as any[];
  const textSels = sels.filter((l) => l.type === "text");
  return (
    <CanvaSheet open={openSheet === "align"} onClose={() => setOpenSheet(null)} title="Align" height="32vh">
      <div className="p-4">
        {textSels.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Text alignment</div>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((a) => (
                <Button key={a} variant="outline" className="h-12"
                  onClick={() => textSels.forEach((l) => updateLayer(l.id, { align: a }))}>
                  {a === "left" && <AlignLeft />}
                  {a === "center" && <AlignCenter />}
                  {a === "right" && <AlignRight />}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Button variant="outline" onClick={() => textSels.forEach((l) => updateLayer(l.id, { fontStyle: l.fontStyle?.includes("bold") ? "normal" : "bold" }))}><Bold className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => textSels.forEach((l) => updateLayer(l.id, { fontStyle: l.fontStyle?.includes("italic") ? "normal" : "italic" }))}><Italic className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => textSels.forEach((l) => updateLayer(l.id, { rtl: !l.rtl }))}>RTL</Button>
            </div>
          </>
        )}
      </div>
    </CanvaSheet>
  );
}

export function AIFieldSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedId, updateLayer } = useDesigner();
  const l = selectedId ? layers.find((x) => x.id === selectedId) : null;
  if (!l) return null;
  return (
    <CanvaSheet open={openSheet === "aiField"} onClose={() => setOpenSheet(null)} title="AI Field Mapping" height="60vh">
      <div className="p-4 space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase text-muted-foreground">Layer name</label>
          <Input value={l.name} onChange={(e) => updateLayer(l.id, { name: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-muted-foreground">Field key (for AI)</label>
          <select value={l.fieldKey ?? ""} onChange={(e) => updateLayer(l.id, { fieldKey: e.target.value as any })}
            className="mt-1 w-full h-10 border rounded-md px-2 text-sm bg-background">
            <option value="">— None (static) —</option>
            <option value="name">name (Full Name)</option>
            <option value="father_name">father_name</option>
            <option value="mother_name">mother_name</option>
            <option value="cnic">cnic / ID Number</option>
            <option value="dob">dob (Date of Birth)</option>
            <option value="doi">doi (Date of Issue)</option>
            <option value="address">address</option>
            <option value="relation">relation</option>
            <option value="phone">phone</option>
            <option value="photo">photo</option>
            <option value="thumb">thumb impression</option>
            <option value="signature">signature</option>
            <option value="custom_1">custom_1</option>
            <option value="custom_2">custom_2</option>
            <option value="custom_3">custom_3</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-muted-foreground">AI Instructions (this layer)</label>
          <Textarea
            value={l.aiInstruction || ""}
            onChange={(e) => updateLayer(l.id, { aiInstruction: e.target.value })}
            placeholder='e.g. "Write in Urdu only", "Passport-size head shot", "Date format DD-MM-YYYY"'
            rows={4} dir="auto" className="mt-1 text-sm"
          />
        </div>
        <div className="text-[11px] text-muted-foreground bg-muted/40 p-3 rounded-md">
          💡 Use a **Field key** to bind this layer to data. The AI will fill matching fields when users run auto-fill.
          The **Instructions** override the template-level rules for this layer only.
        </div>
      </div>
    </CanvaSheet>
  );
}

export function AIInstructionsSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const [text, setText] = useState<string>(() => {
    try { return localStorage.getItem("designer.aiInstructions") || ""; } catch { return ""; }
  });
  const save = (v: string) => {
    setText(v);
    try { localStorage.setItem("designer.aiInstructions", v); } catch { /* ignore */ }
  };
  return (
    <CanvaSheet open={openSheet === "aiInstructions"} onClose={() => setOpenSheet(null)} title="AI Template Instructions" height="65vh">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">
          Tell the AI exactly how to fill this template on the user side. Per-layer instructions override these rules.
        </div>
        <Textarea
          value={text} onChange={(e) => save(e.target.value)} rows={14} dir="auto"
          placeholder={`Examples:
- Name: write in Urdu in "Name", English transliteration in "Name (EN)".
- Photo: passport-size, face centered, white background.
- Address1 = current address, Address2 = permanent address.
- Dates: DD-MM-YYYY.`}
          className="text-sm"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => save("")}>Clear</Button>
          <Button onClick={() => { setOpenSheet(null); toast.success("Instructions saved"); }}>Done</Button>
        </div>
      </div>
    </CanvaSheet>
  );
}

export function LayersSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { layers, selectedId, selectLayer, updateLayer, deleteLayer, moveLayer, memberNames, selectSlot } = useDesigner();
  // Group layers by slot
  const slots = new Map<number, typeof layers>();
  for (const l of [...layers].reverse()) {
    const k = l.slotIndex ?? 0;
    if (!slots.has(k)) slots.set(k, [] as any);
    slots.get(k)!.push(l);
  }
  const slotKeys = Array.from(slots.keys()).sort((a, b) => a - b);
  return (
    <CanvaSheet open={openSheet === "layers"} onClose={() => setOpenSheet(null)} title="Layers" height="70vh">
      <div className="p-2 space-y-2">
        {slotKeys.map((slot) => {
          const slotLayers = slots.get(slot)!;
          const name = slot === 0 ? "Static layers" : (memberNames[slot] || `Member ${slot}`);
          return (
            <div key={slot} className="border rounded-lg overflow-hidden">
              <button onClick={() => slot > 0 && selectSlot(slot)}
                className={cn("w-full px-3 py-2 flex items-center justify-between text-sm font-semibold",
                  slot === 0 ? "bg-muted/40" : "bg-primary/5")}>
                <span className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  {name}
                </span>
                <span className="text-[10px] text-muted-foreground">{slotLayers.length}</span>
              </button>
              <div className="divide-y">
                {slotLayers.map((l) => (
                  <div key={l.id}
                    className={cn("flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                      selectedId === l.id ? "bg-primary/10" : "hover:bg-accent")}
                    onClick={() => selectLayer(l.id)}>
                    <button onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible } as any); }}
                      className="h-7 w-7 grid place-items-center hover:bg-accent rounded">
                      {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { locked: !l.locked } as any); }}
                      className="h-7 w-7 grid place-items-center hover:bg-accent rounded">
                      {l.locked ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <span className="truncate flex-1">{l.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase shrink-0">{l.type}</span>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "up"); }}
                      className="h-7 w-7 grid place-items-center hover:bg-accent rounded">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "down"); }}
                      className="h-7 w-7 grid place-items-center hover:bg-accent rounded">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                      className="h-7 w-7 grid place-items-center hover:bg-destructive/10 text-destructive rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {layers.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No layers yet — tap Text, Image, or Shape below.</div>
        )}
      </div>
    </CanvaSheet>
  );
}

export function BackgroundSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { setBackground, background } = useDesigner();
  const pick = () => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*";
    i.onchange = () => {
      const f = i.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => setBackground({ src: String(r.result), width: img.width, height: img.height });
        img.src = String(r.result);
      };
      r.readAsDataURL(f);
    };
    i.click();
  };
  return (
    <CanvaSheet open={openSheet === "background"} onClose={() => setOpenSheet(null)} title="Background" height="40vh">
      <div className="p-4 space-y-3">
        <Button onClick={pick} className="w-full h-12">Choose image</Button>
        {background.src && (
          <Button variant="outline" onClick={() => setBackground({ src: null })} className="w-full">
            Remove background
          </Button>
        )}
        <div>
          <div className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Solid colors</div>
          <div className="grid grid-cols-8 gap-2">
            {["#ffffff", "#f8fafc", "#fee2e2", "#fef3c7", "#dcfce7", "#dbeafe", "#ede9fe", "#fce7f3"].map((c) => (
              <button key={c} onClick={() => setBackground({ src: null })}
                className="aspect-square rounded-md border" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </CanvaSheet>
  );
}

export function PageSizeSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { setSize, canvasWidth, canvasHeight } = useDesigner();
  return (
    <CanvaSheet open={openSheet === "pageSize"} onClose={() => setOpenSheet(null)} title="Page size" height="50vh">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-16" onClick={() => setSize("a4p")}>A4 Portrait<br /><span className="text-[10px] text-muted-foreground">794 × 1123</span></Button>
          <Button variant="outline" className="h-16" onClick={() => setSize("a4l")}>A4 Landscape<br /><span className="text-[10px] text-muted-foreground">1123 × 794</span></Button>
          <Button variant="outline" className="h-16" onClick={() => setSize("custom", 638, 1012)}>ID Card<br /><span className="text-[10px] text-muted-foreground">638 × 1012</span></Button>
          <Button variant="outline" className="h-16" onClick={() => setSize("custom", 1050, 600)}>Card (landscape)<br /><span className="text-[10px] text-muted-foreground">1050 × 600</span></Button>
        </div>
        <div className="border-t pt-3">
          <div className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Custom size (px)</div>
          <div className="flex gap-2 items-end">
            <Field2 label="Width" defaultValue={canvasWidth} onSubmit={(w) => setSize("custom", w, canvasHeight)} />
            <Field2 label="Height" defaultValue={canvasHeight} onSubmit={(h) => setSize("custom", canvasWidth, h)} />
          </div>
        </div>
      </div>
    </CanvaSheet>
  );
}

function Field2({ label, defaultValue, onSubmit }: { label: string; defaultValue: number; onSubmit: (v: number) => void }) {
  const [v, setV] = useState(String(defaultValue));
  return (
    <label className="flex-1 block">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input type="number" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = Math.max(50, +v || defaultValue); onSubmit(n); }} />
    </label>
  );
}

export function UploadsSheet() {
  const { openSheet, setOpenSheet } = useDock();
  const { addLayer, canvasWidth } = useDesigner();
  const pick = () => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*";
    i.onchange = () => {
      const f = i.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = Math.min(canvasWidth * 0.6, 400);
          const ratio = img.width / img.height;
          const w = Math.min(img.width, max);
          const h = w / ratio;
          addLayer({
            id: makeId(), name: f.name.replace(/\.[^.]+$/, ""), type: "image",
            x: 40, y: 40, width: w, height: h, rotation: 0, opacity: 1, visible: true, locked: false,
            src: String(r.result), fit: "cover", subtype: "asset",
          } as any);
          setOpenSheet(null);
        };
        img.src = String(r.result);
      };
      r.readAsDataURL(f);
    };
    i.click();
  };
  return (
    <CanvaSheet open={openSheet === "uploads"} onClose={() => setOpenSheet(null)} title="Uploads" height="40vh">
      <div className="p-6 text-center space-y-3">
        <Button onClick={pick} className="h-14 px-8 text-base">+ Upload image</Button>
        <div className="text-xs text-muted-foreground">PNG, JPG, WebP — added to current page.</div>
      </div>
    </CanvaSheet>
  );
}
