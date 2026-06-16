import { useEffect, useRef, useState } from "react";
import { Stage, Layer as KLayer, Rect, Text, Image as KImage, Transformer, Group, Line } from "react-konva";
import type Konva from "konva";
import { useDesigner, makeId } from "@/lib/designer/store";
import type { ImageLayer, Layer, TextLayer, BoxLayer, LineLayer } from "@/lib/designer/types";
import { Copy, Trash2, Lock, Unlock, MoreHorizontal, Pencil } from "lucide-react";
import { useDock } from "./canva/dockState";
import { toast } from "sonner";


function useHTMLImage(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.src = src;
    i.onload = () => setImg(i);
  }, [src]);
  return img;
}

function fitRect(iw: number, ih: number, bw: number, bh: number, mode: ImageLayer["fit"]) {
  if (mode === "stretch") return { x: 0, y: 0, w: bw, h: bh };
  const ir = iw / ih;
  const br = bw / bh;
  if (mode === "fit" || mode === "contain") {
    if (ir > br) { const h = bw / ir; return { x: 0, y: (bh - h) / 2, w: bw, h }; }
    const w = bh * ir; return { x: (bw - w) / 2, y: 0, w, h: bh };
  }
  // cover / crop / fill
  if (ir > br) { const w = bh * ir; return { x: (bw - w) / 2, y: 0, w, h: bh }; }
  const h = bw / ir; return { x: 0, y: (bh - h) / 2, w: bw, h };
}

interface NodeProps<T extends Layer> {
  layer: T;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (p: Partial<T>) => void;
  onDragEnd: (newX: number, newY: number) => void;
  onDblClick?: () => void;
  nodeRef: (n: Konva.Node | null) => void;
  passive?: boolean;
}

function ImageNode({ layer, isSelected, onSelect, onChange, onDragEnd, nodeRef, passive }: NodeProps<ImageLayer>) {
  const img = useHTMLImage(layer.src);
  const groupRef = useRef<Konva.Group>(null);
  useEffect(() => { nodeRef(groupRef.current); return () => nodeRef(null); }, [nodeRef]);
  const fitted = img ? fitRect(img.width, img.height, layer.width, layer.height, layer.fit) : null;
  return (
    <Group
      ref={groupRef}
      x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      rotation={layer.rotation} opacity={layer.opacity} visible={layer.visible}
      listening={!layer.locked && !passive}
      draggable={!layer.locked && !passive} onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransformEnd={() => {
        const node = groupRef.current; if (!node) return;
        const sx = node.scaleX(), sy = node.scaleY();
        node.scaleX(1); node.scaleY(1);
        onChange({ x: node.x(), y: node.y(),
          width: Math.max(10, layer.width * sx), height: Math.max(10, layer.height * sy),
          rotation: node.rotation() });
      }}
      clipFunc={(ctx) => { ctx.rect(0, 0, layer.width, layer.height); }}
    >
      <Rect width={layer.width} height={layer.height}
        fill={img ? "transparent" : "#f1f5f9"}
        stroke={img ? undefined : isSelected ? "#a855f7" : "#cbd5e1"}
        strokeWidth={1} dash={img ? undefined : [6, 4]} />
      {img && fitted && (<KImage image={img} x={fitted.x} y={fitted.y} width={fitted.w} height={fitted.h} />)}
      {!img && (<Text text="IMAGE" width={layer.width} height={layer.height} align="center" verticalAlign="middle" fontSize={14} fill="#64748b" listening={false} />)}
    </Group>
  );
}

function TextNode({ layer, onSelect, onChange, onDragEnd, onDblClick, nodeRef }: NodeProps<TextLayer>) {
  const ref = useRef<Konva.Text>(null);
  useEffect(() => { nodeRef(ref.current); return () => nodeRef(null); }, [nodeRef]);
  return (
    <Text
      ref={ref}
      text={layer.text} x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      fontSize={layer.fontSize} fontFamily={layer.fontFamily} fontStyle={layer.fontStyle}
      fill={layer.fill} align={layer.align} rotation={layer.rotation}
      opacity={layer.opacity} visible={layer.visible}
      listening={!layer.locked}
      draggable={!layer.locked}
      onClick={onSelect} onTap={onSelect}
      onDblClick={onDblClick} onDblTap={onDblClick}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransformEnd={() => {
        const node = ref.current; if (!node) return;
        const sx = node.scaleX(), sy = node.scaleY();
        const avg = (sx + sy) / 2;
        node.scaleX(1); node.scaleY(1);
        onChange({ x: node.x(), y: node.y(),
          width: Math.max(20, layer.width * sx), height: Math.max(10, layer.height * sy),
          fontSize: Math.max(6, layer.fontSize * avg), rotation: node.rotation() });
      }}
    />
  );
}

function BoxNode({ layer, onSelect, onChange, onDragEnd, nodeRef }: NodeProps<BoxLayer>) {
  const ref = useRef<Konva.Rect>(null);
  useEffect(() => { nodeRef(ref.current); return () => nodeRef(null); }, [nodeRef]);
  return (
    <Rect ref={ref} x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth}
      rotation={layer.rotation} opacity={layer.opacity} visible={layer.visible}
      listening={!layer.locked}
      draggable={!layer.locked} onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransformEnd={() => {
        const node = ref.current; if (!node) return;
        const sx = node.scaleX(), sy = node.scaleY();
        node.scaleX(1); node.scaleY(1);
        onChange({ x: node.x(), y: node.y(),
          width: Math.max(5, layer.width * sx), height: Math.max(5, layer.height * sy),
          rotation: node.rotation() });
      }}
    />
  );
}

function LineNode({ layer, onSelect, onChange, onDragEnd, nodeRef }: NodeProps<LineLayer>) {
  const ref = useRef<Konva.Line>(null);
  useEffect(() => { nodeRef(ref.current); return () => nodeRef(null); }, [nodeRef]);
  return (
    <Line ref={ref} x={layer.x} y={layer.y} points={[0, 0, layer.width, 0]}
      stroke={layer.stroke} strokeWidth={layer.strokeWidth}
      rotation={layer.rotation} opacity={layer.opacity} visible={layer.visible}
      listening={!layer.locked}
      draggable={!layer.locked} onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransformEnd={() => {
        const node = ref.current; if (!node) return;
        const sx = node.scaleX(); node.scaleX(1); node.scaleY(1);
        onChange({ x: node.x(), y: node.y(),
          width: Math.max(5, layer.width * sx), rotation: node.rotation() });
      }}
      hitStrokeWidth={Math.max(layer.strokeWidth, 12)}
    />
  );
}

function isPageBackgroundLayer(layer: Layer, canvasWidth: number, canvasHeight: number) {
  if (layer.type !== "image" || layer.slotIndex) return false;
  const name = layer.name.toLowerCase();
  const namedBackground = /background|template|base|frc|bg\b/.test(name);
  const coversPage = layer.x <= 3 && layer.y <= 3 && layer.width >= canvasWidth * 0.96 && layer.height >= canvasHeight * 0.96;
  return namedBackground || coversPage;
}

export function DesignerCanvas({ stageRef, onOpenMore }: { stageRef: React.MutableRefObject<Konva.Stage | null>; onOpenMore?: () => void }) {
  const {
    background, canvasWidth, canvasHeight, layers,
    selectedId, selectedIds, selectLayer, selectIds, updateLayer, translateSlot, userZoom, setUserZoom,
    duplicateLayer, deleteLayer, addLayer,
  } = useDesigner();
  const { activeTool, setActiveTool, toolColor, setToolColor, openSheet, setOpenSheet } = useDock();
  const selectedLayer = selectedIds.length === 1 ? layers.find((l) => l.id === selectedIds[0]) : null;
  const bgImg = useHTMLImage(background.src);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeMap = useRef<Map<string, Konva.Node>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; value: string; x: number; y: number; w: number; h: number; fontSize: number; fontFamily: string; color: string; align: string; rtl?: boolean } | null>(null);
  const scale = fitScale * userZoom;
  const backgroundLayerIds = new Set(layers.filter((layer) => isPageBackgroundLayer(layer, canvasWidth, canvasHeight)).map((layer) => layer.id));
  const activeSelectedIds = selectedIds.filter((id) => !backgroundLayerIds.has(id));
  const selectedLayer = activeSelectedIds.length === 1 ? layers.find((l) => l.id === activeSelectedIds[0]) : null;
  const displayLayers = [...layers].sort((a, b) => Number(isPageBackgroundLayer(b, canvasWidth, canvasHeight)) - Number(isPageBackgroundLayer(a, canvasWidth, canvasHeight)));

  // Pinch-to-zoom only the canvas
  const pinchRef = useRef<{ dist: number; baseZoom: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: dist(e.touches), baseZoom: useDesigner.getState().userZoom };
        e.preventDefault();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        const d = dist(e.touches);
        setUserZoom(pinchRef.current.baseZoom * (d / pinchRef.current.dist));
        e.preventDefault();
      }
    };
    const onTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinchRef.current = null; };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    const blockGesture = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", blockGesture);
    el.addEventListener("gesturechange", blockGesture);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("gesturestart", blockGesture);
      el.removeEventListener("gesturechange", blockGesture);
    };
  }, [setUserZoom]);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth - 32;
      const ch = containerRef.current.clientHeight - 32;
      const s = Math.min(cw / canvasWidth, ch / canvasHeight, 1);
      setFitScale(s);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (activeSelectedIds.length === 0) { tr.nodes([]); tr.getLayer()?.batchDraw(); return; }
    const nodes = activeSelectedIds.map((id) => nodeMap.current.get(id)).filter(Boolean) as Konva.Node[];
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [activeSelectedIds, layers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Tool shortcuts (work regardless of selection)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "v" || e.key === "V") { setActiveTool("select"); return; }
        if (e.key === "r" || e.key === "R") { setActiveTool("rect"); return; }
        if (e.key === "g" || e.key === "G") { setActiveTool("fill"); return; }
        if (e.key === "i" || e.key === "I") { setActiveTool("eyedropper"); return; }
      }
      if (!selectedId) return;
      const layer = layers.find((l) => l.id === selectedId);
      if (!layer) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp") { updateLayer(selectedId, { y: layer.y - step }); e.preventDefault(); }
      else if (e.key === "ArrowDown") { updateLayer(selectedId, { y: layer.y + step }); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { updateLayer(selectedId, { x: layer.x - step }); e.preventDefault(); }
      else if (e.key === "ArrowRight") { updateLayer(selectedId, { x: layer.x + step }); e.preventDefault(); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        useDesigner.getState().deleteLayer(selectedId); e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, layers, updateLayer, setActiveTool]);

  const setNodeRef = (id: string) => (n: Konva.Node | null) => {
    if (n) nodeMap.current.set(id, n);
    else nodeMap.current.delete(id);
  };

  const handleDragEnd = (layer: Layer) => (newX: number, newY: number) => {
    const dx = newX - layer.x;
    const dy = newY - layer.y;
    if (layer.slotIndex && layer.slotIndex > 0) {
      translateSlot(layer.slotIndex, dx, dy);
    } else {
      updateLayer(layer.id, { x: newX, y: newY });
    }
  };

  const drawingRect = useRef<"rect" | null>(null);

  const stagePoint = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return { x: pos.x / scale, y: pos.y / scale };
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Eyedropper: pick color from any pixel on stage
    if (activeTool === "eyedropper") {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (stage && pos) {
        try {
          const canvas = stage.toCanvas({ pixelRatio: 1 });
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const d = ctx.getImageData(pos.x, pos.y, 1, 1).data;
            const hex = "#" + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("");
            setToolColor(hex);
            toast.success(`Picked ${hex.toUpperCase()}`);
            setActiveTool("select");
          }
        } catch (err) {
          console.error(err);
          toast.error("Color pick failed");
        }
      }
      return;
    }
    // Rect tool: start drawing
    if (activeTool === "rect" && e.target === e.target.getStage()) {
      const p = stagePoint(e);
      if (!p) return;
      drawingRect.current = "rect";
      marqueeStart.current = p;
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    // Default select tool: marquee select
    if (e.target !== e.target.getStage()) return;
    selectLayer(null);
    const p = stagePoint(e);
    if (!p) return;
    marqueeStart.current = p;
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!marqueeStart.current) return;
    const p = stagePoint(e);
    if (!p) return;
    const s = marqueeStart.current;
    setMarquee({
      x: Math.min(s.x, p.x), y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y),
    });
  };

  const handleStageMouseUp = () => {
    if (!marquee || !marqueeStart.current) { marqueeStart.current = null; setMarquee(null); drawingRect.current = null; return; }
    const m = marquee;
    // Rect tool: create a BoxLayer
    if (drawingRect.current === "rect") {
      if (m.w > 5 && m.h > 5) {
        addLayer({
          id: makeId(), name: "Rectangle", type: "box",
          x: m.x, y: m.y, width: m.w, height: m.h,
          rotation: 0, opacity: 1, visible: true, locked: false,
          fill: toolColor, stroke: toolColor, strokeWidth: 0,
        } as Layer);
        setActiveTool("select");
      }
      drawingRect.current = null;
      marqueeStart.current = null;
      setMarquee(null);
      return;
    }
    // Marquee select
    if (m.w > 5 && m.h > 5) {
      const inside = layers.filter((l) => {
        if (!l.visible) return false;
        return l.x + l.width >= m.x && l.x <= m.x + m.w && l.y + l.height >= m.y && l.y <= m.y + m.h;
      }).map((l) => l.id);
      if (inside.length > 0) selectIds(inside);
    }
    marqueeStart.current = null;
    setMarquee(null);
  };

  const beginEditText = (layer: TextLayer) => {
    setEditingText({
      id: layer.id, value: layer.text,
      x: layer.x, y: layer.y, w: layer.width, h: layer.height,
      fontSize: layer.fontSize, fontFamily: layer.fontFamily,
      color: layer.fill, align: layer.align, rtl: layer.rtl,
    });
  };
  const commitEditText = () => {
    if (!editingText) return;
    updateLayer(editingText.id, { text: editingText.value } as any);
    setEditingText(null);
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-muted/40 flex items-center justify-center p-4 relative" style={{ touchAction: "pan-x pan-y", cursor: activeTool === "rect" ? "crosshair" : activeTool === "fill" ? "cell" : activeTool === "eyedropper" ? "crosshair" : "default" }}>
      <div className="bg-white shadow-2xl relative" style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
        <Stage
          ref={(s) => { stageRef.current = s; }}
          width={canvasWidth * scale} height={canvasHeight * scale}
          scaleX={scale} scaleY={scale}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageMouseDown as any}
          onTouchMove={handleStageMouseMove as any}
          onTouchEnd={handleStageMouseUp}
        >
          <KLayer listening={false}>
            <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#ffffff" />
            {bgImg && (<KImage image={bgImg} x={0} y={0} width={canvasWidth} height={canvasHeight} />)}
          </KLayer>
          <KLayer>
            {displayLayers.map((layer) => {
              const isSel = selectedIds.includes(layer.id);
              const passiveBackground = isPageBackgroundLayer(layer, canvasWidth, canvasHeight);
              const onSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
                // Fill tool: tap layer → fill with toolColor
                if (activeTool === "fill") {
                  if (layer.type === "text" || layer.type === "box") {
                    updateLayer(layer.id, { fill: toolColor } as any);
                  } else if (layer.type === "line") {
                    updateLayer(layer.id, { stroke: toolColor } as any);
                  }
                  toast.success(`Filled ${toolColor.toUpperCase()}`);
                  e.cancelBubble = true;
                  return;
                }
                const native = e.evt as MouseEvent;
                selectLayer(layer.id, native?.shiftKey || (native as any)?.ctrlKey || (native as any)?.metaKey);
                // If a property/background sheet is open, dismiss it so the new selection's context applies
                if (openSheet) setOpenSheet(null);
              };
              const common = {
                isSelected: isSel,
                onSelect,
                onChange: (p: Partial<Layer>) => updateLayer(layer.id, p),
                onDragEnd: handleDragEnd(layer),
                nodeRef: setNodeRef(layer.id),
                passive: passiveBackground,
              };
              if (layer.type === "text") return <TextNode key={layer.id} layer={layer} {...common} onChange={common.onChange as any} onDblClick={() => beginEditText(layer)} />;
              if (layer.type === "image") return <ImageNode key={layer.id} layer={layer} {...common} onChange={common.onChange as any} />;
              if (layer.type === "line") return <LineNode key={layer.id} layer={layer} {...common} onChange={common.onChange as any} />;
              return <BoxNode key={layer.id} layer={layer} {...common} onChange={common.onChange as any} />;
            })}
            <Transformer
              ref={transformerRef}
              rotateEnabled keepRatio={false} shouldOverdrawWholeArea
              anchorSize={12}
              anchorStroke="#00C4CC"
              anchorFill="#ffffff"
              anchorCornerRadius={6}
              borderStroke="#00C4CC"
              borderStrokeWidth={1.5}
              rotateAnchorOffset={28}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
            />
            {marquee && (
              <Rect
                x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
                fill={drawingRect.current === "rect" ? `${toolColor}33` : "rgba(0,196,204,0.12)"}
                stroke={drawingRect.current === "rect" ? toolColor : "#00C4CC"}
                strokeWidth={1}
                dash={drawingRect.current === "rect" ? undefined : [4, 3]}
                listening={false}
              />
            )}
          </KLayer>
        </Stage>

        {/* Inline text editor overlay */}
        {editingText && (
          <textarea
            value={editingText.value}
            autoFocus
            onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
            onBlur={commitEditText}
            onKeyDown={(e) => {
              if (e.key === "Escape") { commitEditText(); }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { commitEditText(); }
            }}
            style={{
              position: "absolute",
              left: editingText.x * scale,
              top: editingText.y * scale,
              width: editingText.w * scale,
              minHeight: editingText.h * scale,
              fontSize: editingText.fontSize * scale,
              fontFamily: editingText.fontFamily,
              color: editingText.color,
              textAlign: editingText.align as any,
              direction: editingText.rtl ? "rtl" : "ltr",
              background: "rgba(255,255,255,0.95)",
              border: "2px solid #a855f7",
              outline: "none",
              padding: 2,
              margin: 0,
              resize: "none",
              lineHeight: 1.2,
              boxSizing: "border-box",
              zIndex: 30,
            }}
          />
        )}

        {/* Floating quick-action toolbar — Canva style */}
        {selectedLayer && !editingText && (() => {
          const left = (selectedLayer.x + selectedLayer.width / 2) * scale;
          const topRaw = selectedLayer.y * scale - 52;
          const top = topRaw < 4 ? (selectedLayer.y + selectedLayer.height) * scale + 8 : topRaw;
          return (
            <div
              className="absolute z-30 -translate-x-1/2 flex items-center gap-0.5 bg-white rounded-full shadow-lg border px-1 py-1"
              style={{ left, top, pointerEvents: "auto" }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {selectedLayer.type === "text" && (
                <button
                  className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent"
                  onClick={() => {
                    const t = selectedLayer as TextLayer;
                    setEditingText({
                      id: t.id, value: t.text, x: t.x, y: t.y, w: t.width, h: t.height,
                      fontSize: t.fontSize, fontFamily: t.fontFamily, color: t.fill,
                      align: t.align, rtl: t.rtl,
                    });
                  }}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent"
                onClick={() => duplicateLayer(selectedLayer.id)}
                aria-label="Duplicate"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent"
                onClick={() => updateLayer(selectedLayer.id, { locked: !selectedLayer.locked } as any)}
                aria-label={selectedLayer.locked ? "Unlock" : "Lock"}
              >
                {selectedLayer.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
              <button
                className="h-9 w-9 grid place-items-center rounded-full hover:bg-destructive/10 text-destructive"
                onClick={() => deleteLayer(selectedLayer.id)}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {onOpenMore && (
                <button
                  className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent"
                  onClick={onOpenMore}
                  aria-label="More"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
