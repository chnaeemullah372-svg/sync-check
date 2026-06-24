import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/lib/designer/store";
import type { Layer, TextLayer } from "@/lib/designer/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Type as TypeIcon,
  Plus,
  Minus,
} from "lucide-react";

/**
 * Press-and-hold nudge pad.
 *
 * - Arrow tap = move by the slider value.
 * - Hold = keep moving at that speed.
 * - Same behavior for text font-size buttons; slider controls resize amount.
 */
export function NudgePad() {
  const { layers, selectedIds, selectedId } = useDesigner();

  // Slider value = exact units per tap/repeat (1..100).
  const [maxStep, setMaxStep] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("designer.nudge.maxStep") || "20");
      return Number.isFinite(v) && v > 0 ? v : 20;
    } catch {
      return 20;
    }
  });
  const [maxFontStep, setMaxFontStep] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("designer.font.maxStep") || "10");
      return Number.isFinite(v) && v > 0 ? v : 10;
    } catch {
      return 10;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("designer.nudge.maxStep", String(maxStep));
    } catch {
      /* */
    }
  }, [maxStep]);
  useEffect(() => {
    try {
      localStorage.setItem("designer.font.maxStep", String(maxFontStep));
    } catch {
      /* */
    }
  }, [maxFontStep]);

  const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const selectedLayers = layers.filter((l) => ids.includes(l.id));
  const hasText = selectedLayers.some((l) => l.type === "text");

  // Use a ref so the press-hold loop always reads the freshest selection/slider.
  const stateRef = useRef({ ids, maxStep, maxFontStep });
  stateRef.current = { ids, maxStep, maxFontStep };

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

  // Generic press-and-hold runner. Slider value is the exact movement/resize speed:
  // low slider = slow/small step, full slider = fast/large step.
  const holdRef = useRef<{ timer: number | null }>({ timer: null });
  const stopHold = useCallback(() => {
    if (holdRef.current.timer) {
      window.clearTimeout(holdRef.current.timer);
      holdRef.current.timer = null;
    }
  }, []);

  const startHold = useCallback(
    (fire: (units: number) => void, getStep: () => number) => {
      stopHold();
      const run = () => {
        const units = Math.max(1, Math.round(getStep()));
        fire(units);
      };
      run();
      const repeat = () => {
        run();
        holdRef.current.timer = window.setTimeout(repeat, 60) as unknown as number;
      };
      holdRef.current.timer = window.setTimeout(repeat, 260) as unknown as number;
    },
    [stopHold],
  );

  useEffect(() => () => stopHold(), [stopHold]);

  if (ids.length === 0) return null;

  const arrowHandlers = (dx: number, dy: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      startHold(
        (u) => doNudge(dx * u, dy * u),
        () => stateRef.current.maxStep,
      );
    },
    onPointerUp: (e: React.PointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      stopHold();
    },
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onLostPointerCapture: stopHold,
  });

  const fontHandlers = (sign: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      startHold(
        (u) => doFont(sign * u),
        () => stateRef.current.maxFontStep,
      );
    },
    onPointerUp: (e: React.PointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      stopHold();
    },
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onLostPointerCapture: stopHold,
  });

  return (
    <div className="border rounded-md p-2 bg-muted/30 space-y-2 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold">Nudge / Move</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">step {maxStep}px</span>
      </div>

      <div className="grid grid-cols-3 gap-1 max-w-[140px] mx-auto">
        <div />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 touch-none"
          title="Up"
          {...arrowHandlers(0, -1)}
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <div />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 touch-none"
          title="Left"
          {...arrowHandlers(-1, 0)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="h-9 w-9 rounded border border-dashed flex items-center justify-center text-[9px] text-muted-foreground">
          {ids.length}
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 touch-none"
          title="Right"
          {...arrowHandlers(1, 0)}
        >
          <ArrowRight className="w-4 h-4" />
        </Button>
        <div />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 touch-none"
          title="Down"
          {...arrowHandlers(0, 1)}
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
        <div />
      </div>

      {/* Max speed slider */}
      <div className="px-1">
        <Slider
          min={1}
          max={100}
          step={1}
          value={[maxStep]}
          onValueChange={(v) => setMaxStep(v[0] ?? 1)}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>slow</span>
          <span>fast</span>
        </div>
      </div>

      {hasText && (
        <div className="pt-1 border-t space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <TypeIcon className="w-3 h-3" /> Text size
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              step {maxFontStep}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 touch-none"
              title="Smaller"
              {...fontHandlers(-1)}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 touch-none"
              title="Larger"
              {...fontHandlers(1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
            <div className="flex-1 px-1">
              <Slider
                min={1}
                max={50}
                step={1}
                value={[maxFontStep]}
                onValueChange={(v) => setMaxFontStep(v[0] ?? 1)}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>slow</span>
                <span>fast</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
