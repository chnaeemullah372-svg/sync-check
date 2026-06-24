import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDesigner } from "@/lib/designer/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye, EyeOff, Lock, Unlock, Trash2, Copy, ChevronUp, ChevronDown,
  ChevronsUp, ChevronsDown, Type, Image as ImageIcon, Square, Minus,
  ChevronRight, Folder, Users, Save, Ungroup, PanelRightClose, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Layer } from "@/lib/designer/types";
import { nameToFieldKey } from "@/lib/designer/aiFieldMap";

export function LayerPanel({ mobile = false, onCollapse }: { mobile?: boolean; onCollapse?: () => void } = {}) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const {
    layers, selectedId, selectedIds, memberNames,
    selectLayer, updateLayer, deleteLayer, duplicateLayer, moveLayer,
    duplicateSlot, ungroupSlot, deleteSlot, renameSlot, selectSlot, saveMemberLocal,
    groupAsMember,
  } = useDesigner();

  // Group layers: slot 0 (static) + per-slot
  const { staticLayers, slots } = useMemo(() => {
    const slotMap = new Map<number, Layer[]>();
    const stat: Layer[] = [];
    for (const l of layers) {
      const s = l.slotIndex ?? 0;
      if (s === 0) stat.push(l);
      else {
        if (!slotMap.has(s)) slotMap.set(s, []);
        slotMap.get(s)!.push(l);
      }
    }
    return {
      staticLayers: [...stat].reverse(),
      slots: Array.from(slotMap.entries()).sort(([a], [b]) => a - b),
    };
  }, [layers]);

  const onAddMember = () => {
    if (selectedIds.length === 0) {
      toast.info("Select one or more layers first (long-press or Shift+Click)");
      return;
    }
    const count = selectedIds.length;
    groupAsMember();
    toast.success(`Member created with ${count} layer${count > 1 ? "s" : ""}`);
  };

  const startSwipe = (e: ReactPointerEvent<HTMLElement>) => {
    if (!mobile) return;
    const tag = (e.target as HTMLElement).tagName;
    if (["BUTTON", "INPUT", "TEXTAREA"].includes(tag)) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const moveSwipe = (e: ReactPointerEvent<HTMLElement>) => {
    if (!mobile || !swipeStart.current) return;
    const dx = Math.max(0, e.clientX - swipeStart.current.x);
    const dy = Math.abs(e.clientY - swipeStart.current.y);
    if (dx > 4 && dx > dy * 0.6) setDragX(Math.min(dx, 360));
  };

  const endSwipe = () => {
    if (!mobile || !swipeStart.current) return;
    swipeStart.current = null;
    if (dragX > 50) onCollapse?.();
    setDragX(0);
  };

  return (
    <aside
      className={mobile ? "relative w-full h-[100dvh] min-h-0 bg-card flex flex-col touch-pan-y" : "w-64 h-full min-h-0 border-l bg-card flex flex-col"}
      style={mobile ? { transform: `translateX(${dragX}px)`, transition: dragX ? "none" : "transform 160ms ease" } : undefined}
      onPointerDown={startSwipe}
      onPointerMove={moveSwipe}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
    >
      {mobile && (
        <div className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground text-center select-none">
          Swipe right anywhere to close →
        </div>
      )}
      <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2 min-w-0">
          {mobile && onCollapse && (
            <button
              onClick={onCollapse}
              className="h-8 px-2 rounded border flex items-center gap-1 text-xs hover:bg-accent"
              title="Close layer panel"
            >
              <PanelRightClose className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <h3 className="font-semibold text-sm">Layers</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{layers.length}</span>
          {onCollapse && !mobile && (
            <button
              onClick={onCollapse}
              className="hover:bg-accent rounded p-1"
              title="Hide layer panel"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sticky Add Member action bar */}
      <div className="px-2 py-1.5 border-b bg-muted/40 flex items-center gap-1 sticky top-9 z-10">
        <Button
          size="sm"
          variant={selectedIds.length > 0 ? "default" : "secondary"}
          className="h-8 flex-1 text-xs"
          onClick={onAddMember}
          disabled={selectedIds.length === 0}
          title="Group selected layers into a new Member"
        >
          <Users className="w-3.5 h-3.5 mr-1" />
          Add Member{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-40" style={{ WebkitOverflowScrolling: "touch" }}>
        {layers.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">
            No layers yet. Add from the tools panel.
          </p>
        )}
        {layers.length > 0 && selectedIds.length === 0 && (
          <p className="text-[10px] text-muted-foreground px-3 py-2 leading-snug">
            💡 Tap to select. <b>Long-press</b> (or Shift+Click) to add to selection,
            then tap <b>Add Member</b>.
          </p>
        )}

        {/* Member slot groups */}
        {slots.map(([slot, slotLayers]) => (
          <SlotGroup
            key={slot}
            slot={slot}
            name={memberNames[slot] || `Member ${slot}`}
            slotLayers={[...slotLayers].reverse()}
            selectedIds={selectedIds}
            selectedId={selectedId}
            selectLayer={selectLayer}
            updateLayer={updateLayer}
            deleteLayer={deleteLayer}
            duplicateLayer={duplicateLayer}
            moveLayer={moveLayer}
            selectSlot={selectSlot}
            duplicateSlot={duplicateSlot}
            ungroupSlot={ungroupSlot}
            deleteSlot={deleteSlot}
            renameSlot={renameSlot}
            onSaveMember={() => {
              const k = saveMemberLocal(slot);
              if (k) toast.success(`Saved ${memberNames[slot] || `Member ${slot}`}`);
            }}
          />
        ))}

        {/* Static layers section */}
        {staticLayers.length > 0 && (
          <div className="border-t bg-muted/20">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <Folder className="w-3 h-3" /> Static layers
            </div>
            {staticLayers.map((layer) => (
              <LayerRow
                key={layer.id} layer={layer}
                isSel={selectedId === layer.id}
                isMulti={selectedIds.includes(layer.id)}
                onSelect={(additive) => selectLayer(layer.id, additive)}
                onToggleVis={() => updateLayer(layer.id, { visible: !layer.visible })}
                onToggleLock={() => updateLayer(layer.id, { locked: !layer.locked })}
                onMove={(d) => moveLayer(layer.id, d)}
                onDuplicate={() => duplicateLayer(layer.id)}
                onDelete={() => deleteLayer(layer.id)}
                onOpacity={(v) => updateLayer(layer.id, { opacity: v })}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SlotGroup(props: {
  slot: number; name: string; slotLayers: Layer[];
  selectedIds: string[]; selectedId: string | null;
  selectLayer: (id: string | null, additive?: boolean) => void;
  updateLayer: (id: string, p: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, d: "up" | "down" | "front" | "back") => void;
  selectSlot: (s: number) => void;
  duplicateSlot: (s: number) => void;
  ungroupSlot: (s: number) => void;
  deleteSlot: (s: number) => void;
  renameSlot: (s: number, n: string) => void;
  onSaveMember: () => void;
}) {
  const {
    slot, name, slotLayers, selectedIds, selectedId,
    selectLayer, updateLayer, deleteLayer, duplicateLayer, moveLayer,
    selectSlot, duplicateSlot, ungroupSlot, deleteSlot, renameSlot, onSaveMember,
  } = props;
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const allVisible = slotLayers.every((l) => l.visible);
  const allLocked = slotLayers.every((l) => l.locked);
  const isGroupSel = slotLayers.every((l) => selectedIds.includes(l.id)) && slotLayers.length > 0;

  return (
    <div className="border-b">
      <div
        onClick={() => selectSlot(slot)}
        className={cn(
          "px-2 py-2 cursor-pointer flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40",
          isGroupSel && "bg-blue-100 dark:bg-blue-900/50",
        )}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="p-0.5 hover:bg-background rounded"
          title={open ? "Collapse" : "Expand"}
        >
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <Users className="w-3.5 h-3.5 text-blue-600" />
        {editing ? (
          <Input
            autoFocus value={name} className="h-6 text-xs flex-1"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => renameSlot(slot, e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
          />
        ) : (
          <span
            className="text-xs font-semibold flex-1 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Double-click to rename"
          >
            {name}
          </span>
        )}
        <span className="text-[9px] bg-blue-600 text-white px-1 rounded">S{slot}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            slotLayers.forEach((l) => updateLayer(l.id, { visible: !allVisible }));
          }}
          className="p-1 hover:bg-background rounded" title={allVisible ? "Hide group" : "Show group"}
        >
          {allVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            slotLayers.forEach((l) => updateLayer(l.id, { locked: !allLocked }));
          }}
          className="p-1 hover:bg-background rounded" title={allLocked ? "Unlock group" : "Lock group"}
        >
          {allLocked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Group action row */}
      <div className="px-2 py-1 flex flex-wrap items-center gap-1 bg-blue-50/50 dark:bg-blue-950/20 border-t border-blue-100 dark:border-blue-900">
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5"
          onClick={(e) => { e.stopPropagation(); duplicateSlot(slot); }}>
          <Copy className="w-3 h-3 mr-1" /> Dup
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5"
          onClick={(e) => { e.stopPropagation(); onSaveMember(); }}>
          <Save className="w-3 h-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5"
          onClick={(e) => { e.stopPropagation(); ungroupSlot(slot); }}>
          <Ungroup className="w-3 h-3 mr-1" /> Ungroup
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete ${name} and all its ${slotLayers.length} layers?`)) deleteSlot(slot);
          }}>
          <Trash2 className="w-3 h-3 mr-1" /> Delete
        </Button>
      </div>

      {open && (
        <div className="pl-3">
          {slotLayers.map((layer) => (
            <LayerRow
              key={layer.id} layer={layer}
              isSel={selectedId === layer.id}
              isMulti={selectedIds.includes(layer.id)}
              onSelect={(additive) => selectLayer(layer.id, additive)}
              onToggleVis={() => updateLayer(layer.id, { visible: !layer.visible })}
              onToggleLock={() => updateLayer(layer.id, { locked: !layer.locked })}
              onMove={(d) => moveLayer(layer.id, d)}
              onDuplicate={() => duplicateLayer(layer.id)}
              onDelete={() => deleteLayer(layer.id)}
              onOpacity={(v) => updateLayer(layer.id, { opacity: v })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LayerRow({
  layer, isSel, isMulti = false, onSelect, onToggleVis, onToggleLock, onMove, onDuplicate, onDelete, onOpacity,
}: {
  layer: Layer;
  isSel: boolean;
  isMulti?: boolean;
  onSelect: (additive: boolean) => void;
  onToggleVis: () => void;
  onToggleLock: () => void;
  onMove: (d: "up" | "down" | "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpacity: (v: number) => void;
}) {
  const { updateLayer } = useDesigner();
  const [editing, setEditing] = useState(false);
  const Icon = layer.type === "text" ? Type : layer.type === "image" ? ImageIcon : layer.type === "line" ? Minus : Square;
  const explicitKey = (layer as any).fieldKey as string | undefined;
  const derivedKey = nameToFieldKey(layer.name);
  const showKey = explicitKey || derivedKey;
  const textLayer = layer.type === "text" ? layer : null;
  const missingFont = !!(textLayer?.missingFont ?? textLayer?.fontMissing);
  const originalFont = textLayer?.originalFontFamily || textLayer?.fontFamily;

  // Long-press → additive selection (mobile multi-select)
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const startPress = () => {
    longPressed.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      onSelect(true);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 400);
  };
  const cancelPress = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  return (
    <div
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onClick={(e) => {
        if (longPressed.current) { longPressed.current = false; return; }
        onSelect(e.shiftKey || e.ctrlKey || e.metaKey);
      }}
      className={cn(
        "px-2 py-2 border-b cursor-pointer hover:bg-accent/50 border-l-2 border-l-transparent",
        isSel && "bg-accent",
        isMulti && "border-l-primary bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(true); }}
          className={cn(
            "w-5 h-5 rounded border flex items-center justify-center text-[10px] shrink-0",
            isMulti ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/40 hover:border-primary",
          )}
          title="Add to / remove from selection"
        >
          {isMulti ? "✓" : "+"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleVis(); }} className="p-1 hover:bg-background rounded" title={layer.visible ? "Hide" : "Show"}>
          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleLock(); }} className="p-1 hover:bg-background rounded" title={layer.locked ? "Unlock" : "Lock"}>
          {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        <Icon className="w-3.5 h-3.5" />
        {textLayer && missingFont ? (
          <span
            title={`Missing font: ${originalFont || "unknown"}. Upload/install this font. Current fallback: ${textLayer.fontFamily}`}
            className="text-amber-600 shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
        ) : null}
        {editing ? (
          <Input
            autoFocus
            value={layer.name}
            className="h-6 text-xs flex-1 px-1"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
          />
        ) : (
          <span
            className="text-xs truncate flex-1"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Double-click to rename (this name is the AI field key)"
          >
            {layer.name}
          </span>
        )}
        {showKey ? (
          <span
            className="text-[9px] bg-emerald-600 text-white px-1 rounded"
            title={`AI field key: ${showKey}${explicitKey ? "" : " (auto from name)"}`}
          >
            {showKey}
          </span>
        ) : null}
      </div>
      {textLayer && (
        <div className="mt-1 ml-20 min-w-0 text-[10px] leading-snug text-muted-foreground">
          <div className="truncate">Font: {originalFont}</div>
          {missingFont && <div className="truncate text-amber-600">Fallback: {textLayer.fontFamily}</div>}
        </div>
      )}
      {isSel && (
        <>
          <div className="mt-2 flex items-center gap-0.5 flex-wrap">
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Bring forward" onClick={(e) => { e.stopPropagation(); onMove("up"); }}><ChevronUp className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Send backward" onClick={(e) => { e.stopPropagation(); onMove("down"); }}><ChevronDown className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="To front" onClick={(e) => { e.stopPropagation(); onMove("front"); }}><ChevronsUp className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="To back" onClick={(e) => { e.stopPropagation(); onMove("back"); }}><ChevronsDown className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}><Copy className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="mt-2">
            <label className="text-[10px] text-muted-foreground">Opacity</label>
            <input type="range" min={0} max={1} step={0.05} value={layer.opacity}
              onChange={(e) => onOpacity(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()} className="w-full" />
          </div>
        </>
      )}
    </div>
  );
}
