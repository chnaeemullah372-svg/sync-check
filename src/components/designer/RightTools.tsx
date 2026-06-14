import { useDesigner } from "@/lib/designer/store";
import {
  Users, Ungroup, Copy, Trash2,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Plus, Minus, Type as TypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import type { Layer, TextLayer } from "@/lib/designer/types";

function ToolBtn({
  onClick, title, disabled, children, variant = "default", extraProps,
}: {
  onClick?: () => void; title: string; disabled?: boolean;
  children: React.ReactNode; variant?: "default" | "danger" | "primary";
  extraProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-9 w-9 flex items-center justify-center rounded border border-transparent transition touch-none select-none",
        "hover:bg-accent hover:border-border",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:border-transparent",
        variant === "primary" && !disabled && "bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary",
        variant === "danger" && !disabled && "text-destructive hover:bg-destructive/10",
      )}
      {...extraProps}
    >
      {children}
    </button>
  );
}

export function RightTools({ className }: { className?: string }) {
  const {
    selectedId, selectedIds, layers,
    groupAsMember, ungroupSlot, duplicateSlot, deleteSlot,
    duplicateLayer, deleteLayer,
  } = useDesigner();

  const selectedLayer = layers.find((l) => l.id === selectedId);
  const slot = selectedLayer?.slotIndex ?? 0;
  const hasSel = selectedIds.length > 0;

  const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const hasText = layers.some((l) => ids.includes(l.id) && l.type === "text");

  // Speed sliders (units per tap / repeat tick) — persisted.
  const [moveStep, setMoveStep] = useState<number>(() => {
    try { const v = Number(localStorage.getItem("designer.nudge.maxStep") || "10"); return v > 0 ? v : 10; }
    catch { return 10; }
  });
  const [fontStep, setFontStep] = useState<number>(() => {
    try { const v = Number(localStorage.getItem("designer.font.maxStep") || "4"); return v > 0 ? v : 4; }
    catch { return 4; }
  });
  useEffect(() => { try { localStorage.setItem("designer.nudge.maxStep", String(moveStep)); } catch { /* */ } }, [moveStep]);
  useEffect(() => { try { localStorage.setItem("designer.font.maxStep", String(fontStep)); } catch { /* */ } }, [fontStep]);

  const stateRef = useRef({ ids, moveStep, fontStep });
  stateRef.current = { ids, moveStep, fontStep };

  const doNudge = useCallback((dx: number, dy: number) => {
    const moving = new Set(stateRef.current.ids);
    if (moving.size === 0) return;
    useDesigner.setState((s) => ({
      layers: s.layers.map((l) =>
        moving.has(l.id) ? ({ ...l, x: l.x + dx, y: l.y + dy } as Layer) : l,
      ),
    }));
  }, []);

  const doFont = useCallback((delta: number) => {
    const resizing = new Set(stateRef.current.ids);
    if (resizing.size === 0) return;
    useDesigner.setState((s) => ({
      layers: s.layers.map((l) => {
        if (!resizing.has(l.id) || l.type !== "text") return l;
        const t = l as TextLayer;
        return { ...t, fontSize: Math.max(6, Math.min(400, t.fontSize + delta)) };
      }),
    }));
  }, []);

  // Press-and-hold
  const holdRef = useRef<{ timer: number | null }>({ timer: null });
  const stopHold = useCallback(() => {
    if (holdRef.current.timer) { window.clearTimeout(holdRef.current.timer); holdRef.current.timer = null; }
  }, []);
  const startHold = useCallback((fire: (u: number) => void, getStep: () => number) => {
    stopHold();
    const run = () => fire(Math.max(1, Math.round(getStep())));
    run();
    const repeat = () => {
      run();
      holdRef.current.timer = window.setTimeout(repeat, 55) as unknown as number;
    };
    holdRef.current.timer = window.setTimeout(repeat, 260) as unknown as number;
  }, [stopHold]);
  useEffect(() => () => stopHold(), [stopHold]);

  const arrowProps = (dx: number, dy: number): React.ButtonHTMLAttributes<HTMLButtonElement> => ({
    onPointerDown: (e) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
      startHold((u) => doNudge(dx * u, dy * u), () => stateRef.current.moveStep);
    },
    onPointerUp: (e) => {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
      stopHold();
    },
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onLostPointerCapture: stopHold,
  });

  const fontProps = (sign: 1 | -1): React.ButtonHTMLAttributes<HTMLButtonElement> => ({
    onPointerDown: (e) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
      startHold((u) => doFont(sign * u), () => stateRef.current.fontStep);
    },
    onPointerUp: (e) => {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
      stopHold();
    },
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onLostPointerCapture: stopHold,
  });

  return (
    <aside className={cn("bg-card border-l flex flex-col items-center gap-1 py-2 px-1 w-12 shrink-0 overflow-y-auto", className)}>
      <ToolBtn
        title={`Group ${selectedIds.length} layer(s) as Member`}
        disabled={selectedIds.length < 1}
        variant="primary"
        onClick={() => { groupAsMember(); toast.success(`Grouped ${selectedIds.length} layer(s) as Member`); }}
      >
        <Users className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Ungroup selected member" disabled={!slot} onClick={() => slot && ungroupSlot(slot)}>
        <Ungroup className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn
        title={slot ? "Duplicate member" : "Duplicate layer"}
        disabled={!hasSel}
        onClick={() => { if (slot) duplicateSlot(slot); else if (selectedId) duplicateLayer(selectedId); }}
      >
        <Copy className="w-4 h-4" />
      </ToolBtn>

      <div className="h-px w-6 bg-border my-1" />

      {/* Directional move pad (press & hold; speed = slider). */}
      <ToolBtn title={`Move up (${moveStep}px / tick)`} disabled={!hasSel} extraProps={arrowProps(0, -1)}>
        <ArrowUp className="w-4 h-4" />
      </ToolBtn>
      <div className="flex gap-0.5">
        <ToolBtn title={`Move left (${moveStep}px / tick)`} disabled={!hasSel} extraProps={arrowProps(-1, 0)}>
          <ArrowLeft className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn title={`Move right (${moveStep}px / tick)`} disabled={!hasSel} extraProps={arrowProps(1, 0)}>
          <ArrowRight className="w-4 h-4" />
        </ToolBtn>
      </div>
      <ToolBtn title={`Move down (${moveStep}px / tick)`} disabled={!hasSel} extraProps={arrowProps(0, 1)}>
        <ArrowDown className="w-4 h-4" />
      </ToolBtn>

      {/* Speed slider for movement */}
      <div className="w-full px-1 pt-1">
        <Slider min={1} max={100} step={1} value={[moveStep]} onValueChange={(v) => setMoveStep(v[0] ?? 1)} />
        <div className="text-[8px] text-center text-muted-foreground tabular-nums">{moveStep}px</div>
      </div>

      {hasText && (
        <>
          <div className="h-px w-6 bg-border my-1" />
          <div className="text-[9px] text-muted-foreground flex items-center gap-0.5">
            <TypeIcon className="w-2.5 h-2.5" /> size
          </div>
          <ToolBtn title={`Larger text (+${fontStep}/tick)`} disabled={!hasText} extraProps={fontProps(1)}>
            <Plus className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title={`Smaller text (-${fontStep}/tick)`} disabled={!hasText} extraProps={fontProps(-1)}>
            <Minus className="w-4 h-4" />
          </ToolBtn>
          <div className="w-full px-1 pt-1">
            <Slider min={1} max={50} step={1} value={[fontStep]} onValueChange={(v) => setFontStep(v[0] ?? 1)} />
            <div className="text-[8px] text-center text-muted-foreground tabular-nums">{fontStep}pt</div>
          </div>
        </>
      )}

      <div className="h-px w-6 bg-border my-1" />

      <ToolBtn
        title={slot ? "Delete member" : "Delete layer"}
        disabled={!hasSel}
        variant="danger"
        onClick={() => {
          if (slot) { if (confirm(`Delete Member ${slot} and all its layers?`)) deleteSlot(slot); }
          else if (selectedId) deleteLayer(selectedId);
        }}
      >
        <Trash2 className="w-4 h-4" />
      </ToolBtn>
    </aside>
  );
}
