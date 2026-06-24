import { useDesigner } from "@/lib/designer/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { FIELD_KEYS } from "@/lib/designer/types";
import { NudgePad } from "./NudgePad";


export function PropertiesPanel({ mobile = false }: { mobile?: boolean } = {}) {
  const { layers, selectedId, updateLayer } = useDesigner();
  const layer = layers.find((l) => l.id === selectedId);
  const fileRef = useRef<HTMLInputElement>(null);
  const asideClass = mobile
    ? "w-full bg-card p-3 overflow-y-auto"
    : "w-64 border-r bg-card p-3 overflow-y-auto";

  if (!layer) {
    return (
      <aside className={asideClass}>
        <h3 className="font-semibold text-sm mb-2">Properties</h3>
        <p className="text-xs text-muted-foreground">Select a layer to edit.</p>
        <div className="mt-4 text-[11px] text-muted-foreground border rounded p-2 leading-relaxed">
          <p className="font-semibold text-foreground mb-1">Member Slots</p>
          <p>Build one member design (text + photo + boxes), assign all those layers the same <b>Slot #</b> below, then use <b>Dup Slot</b> in the toolbar to add more members on the page.</p>
        </div>
      </aside>
    );
  }

  const update = (p: any) => updateLayer(layer.id, p);

  return (
    <aside className={asideClass}>
      <h3 className="font-semibold text-sm mb-3">Properties</h3>

      {/* Arrow nudge + text-size pad (always visible when a layer is selected) */}
      <div className="mb-3">
        <NudgePad />
      </div>



      <div className="space-y-3">
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={layer.name} onChange={(e) => update({ name: e.target.value })} className="h-8" />
        </div>

        {/* Member Slot # — central concept */}
        <div className="border rounded p-2 bg-muted/30">
          <Label className="text-xs font-semibold">Member Slot #</Label>
          <Input
            type="number" min={0}
            value={layer.slotIndex ?? 0}
            onChange={(e) => update({ slotIndex: Math.max(0, Number(e.target.value)) })}
            className="h-8 mt-1"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            0 = static. 1,2,3… = member slot. Same number = same group.
          </p>
        </div>

        {/* Field Key — for AI auto-fill mapping */}
        {(layer.type === "text" || layer.type === "image") && (
          <div>
            <Label className="text-xs">Field Key (AI bind)</Label>
            <Select
              value={(layer as any).fieldKey || "__none__"}
              onValueChange={(v) => update({ fieldKey: v === "__none__" ? "" : v })}
            >
              <SelectTrigger className="h-8"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {FIELD_KEYS.map((k) => (
                  <SelectItem key={k || "none"} value={k || "__none__"}>
                    {k || "(none / static)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Per-layer AI / image instruction — saved with the layer JSON */}
        <div>
          <Label className="text-xs">AI / Image Instruction</Label>
          <Textarea
            rows={3}
            value={(layer as any).aiInstruction ?? ""}
            onChange={(e) => update({ aiInstruction: e.target.value })}
            placeholder={
              layer.type === "image"
                ? "e.g. Passport-size photo. Face centered. Head & shoulders visible. Crop to fit box."
                : "Hint for AI when filling this field."
            }
            className="text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Overrides the template-wide AI command for this layer only.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">X</Label><Input type="number" value={Math.round(layer.x)} onChange={(e) => update({ x: Number(e.target.value) })} className="h-8" /></div>
          <div><Label className="text-xs">Y</Label><Input type="number" value={Math.round(layer.y)} onChange={(e) => update({ y: Number(e.target.value) })} className="h-8" /></div>
          <div><Label className="text-xs">W</Label><Input type="number" value={Math.round(layer.width)} onChange={(e) => update({ width: Number(e.target.value) })} className="h-8" /></div>
          <div><Label className="text-xs">H</Label><Input type="number" value={Math.round(layer.height)} onChange={(e) => update({ height: Number(e.target.value) })} className="h-8" /></div>
        </div>

        {layer.type === "text" && (
          <>
            <div>
              <Label className="text-xs">Text</Label>
              <Textarea value={layer.text} onChange={(e) => update({ text: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Size</Label><Input type="number" value={Math.round(layer.fontSize)} onChange={(e) => update({ fontSize: Number(e.target.value) })} className="h-8" /></div>
              <div><Label className="text-xs">Color</Label><Input type="color" value={layer.fill} onChange={(e) => update({ fill: e.target.value })} className="h-8 p-1" /></div>
            </div>
            <div>
              <Label className="text-xs">Font</Label>
              <Select value={layer.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Tahoma", "Trebuchet MS", "Impact", "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu"].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Style</Label>
                <Select value={layer.fontStyle} onValueChange={(v) => update({ fontStyle: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                    <SelectItem value="bold italic">Bold Italic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Align</Label>
                <Select value={layer.align} onValueChange={(v) => update({ align: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!layer.rtl} onChange={(e) => update({ rtl: e.target.checked })} />
              RTL (Urdu / Arabic)
            </label>
          </>
        )}

        {layer.type === "image" && (
          <>
            <div>
              <Label className="text-xs">Image Subtype</Label>
              <Select value={layer.subtype} onValueChange={(v) => update({ subtype: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Photo (passport / face)</SelectItem>
                  <SelectItem value="thumb">Thumb (fingerprint)</SelectItem>
                  <SelectItem value="signature">Signature</SelectItem>
                  <SelectItem value="cnic_copy">CNIC Copy</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="asset">Static asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => update({ src: r.result as string });
                r.readAsDataURL(f);
              }}
            />
            <Button size="sm" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" /> {layer.src ? "Replace Image" : "Upload Image"}
            </Button>
            <div>
              <Label className="text-xs">Fit Mode</Label>
              <Select value={layer.fit} onValueChange={(v) => update({ fit: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover (center crop)</SelectItem>
                  <SelectItem value="contain">Contain (whole image visible)</SelectItem>
                  <SelectItem value="crop">Center Crop</SelectItem>
                  <SelectItem value="fit">Fit</SelectItem>
                  <SelectItem value="fill">Fill</SelectItem>
                  <SelectItem value="stretch">Stretch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Face / Crop Mode</Label>
              <Select
                value={(layer as any).faceCrop || "none"}
                onValueChange={(v) => update({ faceCrop: v })}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="passport">Passport size (head & shoulders)</SelectItem>
                  <SelectItem value="face_center">Face centered</SelectItem>
                  <SelectItem value="head_visible">Head visible (top bias)</SelectItem>
                  <SelectItem value="shoulders_visible">Shoulders visible</SelectItem>
                  <SelectItem value="keep_inside">Keep inside box (thumb / signature)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Applied automatically when the user uploads an image.
              </p>
            </div>
            <div>
              <Label className="text-xs">Share Group</Label>
              <Input
                value={(layer as any).shareGroup ?? ""}
                onChange={(e) => update({ shareGroup: e.target.value })}
                placeholder="e.g. photo_main"
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Image layers with the same tag share one upload. Leave empty for separate uploads.
              </p>
            </div>
          </>
        )}

        {layer.type === "box" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Fill</Label>
                <Input type="color" value={layer.fill === "transparent" ? "#ffffff" : layer.fill}
                  onChange={(e) => update({ fill: e.target.value })} className="h-8 p-1" />
              </div>
              <div>
                <Label className="text-xs">Stroke</Label>
                <Input type="color" value={layer.stroke} onChange={(e) => update({ stroke: e.target.value })} className="h-8 p-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Stroke Width</Label>
              <Input type="number" value={layer.strokeWidth} onChange={(e) => update({ strokeWidth: Number(e.target.value) })} className="h-8" />
            </div>
            <Button size="sm" variant="ghost" className="w-full text-xs"
              onClick={() => update({ fill: layer.fill === "transparent" ? "#ffffff" : "transparent" })}>
              Toggle Transparent Fill
            </Button>
          </>
        )}

        {layer.type === "line" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Color</Label>
                <Input type="color" value={layer.stroke} onChange={(e) => update({ stroke: e.target.value })} className="h-8 p-1" />
              </div>
              <div>
                <Label className="text-xs">Width</Label>
                <Input type="number" value={layer.strokeWidth} onChange={(e) => update({ strokeWidth: Number(e.target.value) })} className="h-8" />
              </div>
            </div>
          </>
        )}

        <div>
          <Label className="text-xs">Rotation: {Math.round(layer.rotation)}°</Label>
          <input type="range" min={-180} max={180} value={layer.rotation}
            onChange={(e) => update({ rotation: Number(e.target.value) })} className="w-full" />
        </div>
      </div>
    </aside>
  );
}
