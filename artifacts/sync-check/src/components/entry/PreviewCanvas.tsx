import { useEffect, useRef, useState } from "react";
import { Stage, Layer as KLayer, Rect, Text, Image as KImage, Line, Transformer, Group } from "react-konva";
import type Konva from "konva";
import type { Layer, TextLayer, ImageLayer, BoxLayer, LineLayer } from "@/lib/designer/types";

export type LayerOverlay = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
}>;

export type AdjustMap = Record<string, LayerOverlay>;

export interface PreviewSnapshot {
  background: { src: string | null; width?: number; height?: number };
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  memberNames?: Record<number, string>;
}

export interface PreviewProps {
  snapshot: PreviewSnapshot;
  memberNo: number;
  values: Record<string, string>;
  images: Record<string, string>;
  /** Multi-slot mode: render ALL slots on a single page, resolving each
   *  layer's text/image from valuesBySlot[slotIndex]. Falls back to single
   *  member mode (filter by memberNo) when not provided. */
  valuesBySlot?: Record<number, Record<string, string>>;
  imagesBySlot?: Record<number, Record<string, string>>;
  stageRef?: React.MutableRefObject<Konva.Stage | null>;
  maxWidth?: number;
  className?: string;
  adjustments?: AdjustMap;
  editable?: boolean;
  onAdjust?: (layerId: string, overlay: LayerOverlay) => void;
}


function useHTMLImage(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.src = src;
    let cancelled = false;
    i.onload = () => {
      if (!cancelled) setImg(i);
    };
    return () => {
      cancelled = true;
    };
  }, [src]);
  return img;
}

function hasBoundValue(values: Record<string, string>, fieldKey?: string) {
  if (!fieldKey) return false;
  const value = values[fieldKey];
  return value != null && String(value).trim() !== "";
}

function fieldKeyOf(layer: Layer) {
  return layer.fieldKey || `layer:${layer.id}`;
}

function fitRect(iw: number, ih: number, bw: number, bh: number, mode: ImageLayer["fit"], faceCrop?: ImageLayer["faceCrop"]) {
  if (mode === "stretch") return { x: 0, y: 0, w: bw, h: bh };
  const ir = iw / ih;
  const br = bw / bh;
  // "fit" / "contain" → letterbox; "fill"/"cover"/"crop" → cover crop
  const isContain = mode === "fit" || mode === "contain";
  if (isContain) {
    if (ir > br) {
      const h = bw / ir;
      return { x: 0, y: (bh - h) / 2, w: bw, h };
    }
    const w = bh * ir;
    return { x: (bw - w) / 2, y: 0, w, h: bh };
  }
  // cover / crop / fill
  let w: number, h: number, x: number, y: number;
  if (ir > br) {
    h = bh;
    w = bh * ir;
    x = (bw - w) / 2;
    y = 0;
  } else {
    w = bw;
    h = bw / ir;
    x = 0;
    y = (bh - h) / 2;
  }
  // Face-crop bias: shift Y upward so head/face stays in frame.
  if (faceCrop && faceCrop !== "none" && h > bh) {
    const overflow = h - bh;
    // bias = fraction of overflow to remove from the BOTTOM (i.e. shift image up)
    const bias =
      faceCrop === "passport" ? 0.75 :
      faceCrop === "face_center" ? 0.6 :
      faceCrop === "head_visible" ? 0.9 :
      faceCrop === "shoulders_visible" ? 0.5 :
      faceCrop === "keep_inside" ? 0.5 : 0.5;
    y = -overflow * bias;
  }
  return { x, y, w, h };
}

/** merge a layer with its overlay before rendering */
function applyOverlay<T extends Layer>(l: T, ov?: LayerOverlay): T {
  if (!ov) return l;
  const merged: any = { ...l };
  if (ov.x != null) merged.x = ov.x;
  if (ov.y != null) merged.y = ov.y;
  if (ov.width != null) merged.width = ov.width;
  if (ov.height != null) merged.height = ov.height;
  if (ov.rotation != null) merged.rotation = ov.rotation;
  if (l.type === "text" && ov.fontSize != null) merged.fontSize = ov.fontSize;
  return merged;
}

export function PreviewCanvas({
  snapshot,
  memberNo,
  values,
  images,
  valuesBySlot,
  imagesBySlot,
  stageRef,
  maxWidth = 800,
  className,
  adjustments,
  editable = false,
  onAdjust,
}: PreviewProps) {
  const bgImg = useHTMLImage(snapshot.background?.src ?? null);
  const W = snapshot.canvasWidth || 794;
  const H = snapshot.canvasHeight || 1123;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(maxWidth);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setContainerW(w);
    });
    ro.observe(el);
    setContainerW(el.clientWidth || maxWidth);
    return () => ro.disconnect();
  }, [maxWidth]);

  const [userZoom, setUserZoom] = useState(1);
  const pinchRef = useRef<{ d: number; z: number } | null>(null);

  const baseScale = Math.min(containerW / W, 1);
  const scale = baseScale * userZoom;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const stageInnerRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    if (!editable) {
      setSelectedId(null);
      return;
    }
  }, [editable]);

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageInnerRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, editable]);

  const multiSlot = !!valuesBySlot;
  const visibleLayers = (snapshot.layers ?? []).filter((l) => {
    if (multiSlot) return true; // render all slots together
    if (l.slotIndex && l.slotIndex > 0) return l.slotIndex === memberNo;
    return true;
  });

  // Resolve per-layer values map (text + image lookups).
  const resolveValues = (l: Layer): { v: Record<string, string>; im: Record<string, string> } => {
    if (!multiSlot) return { v: values, im: images };
    const s = l.slotIndex && l.slotIndex > 0 ? l.slotIndex : 1; // static → slot 1
    return {
      v: valuesBySlot![s] ?? {},
      im: (imagesBySlot && imagesBySlot[s]) ?? {},
    };
  };


  const handleSelect = (id: string) => {
    if (!editable) return;
    setSelectedId(id);
  };

  const commit = (id: string, ov: LayerOverlay) => {
    onAdjust?.(id, ov);
  };

  const dist = (a: React.Touch, b: React.Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  return (
    <div ref={wrapRef} className={`w-full max-w-full ${className ?? ""}`}>
      <div className="mb-2 flex items-center justify-center gap-2 text-[11px] font-bold text-user-muted">
        <button type="button" onClick={() => setUserZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="rounded border border-user-border bg-user-surface px-2 py-0.5 hover:bg-user-page" aria-label="Zoom out">−</button>
        <span className="w-12 text-center tabular-nums">{Math.round(userZoom * 100)}%</span>
        <button type="button" onClick={() => setUserZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} className="rounded border border-user-border bg-user-surface px-2 py-0.5 hover:bg-user-page" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setUserZoom(1)} className="ml-1 rounded border border-user-border bg-user-surface px-2 py-0.5 hover:bg-user-page">Fit</button>
      </div>
      <div
        className="mx-auto overflow-auto rounded-md border border-user-border bg-user-page"
        style={{ maxHeight: "78vh", touchAction: "pan-x pan-y" }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinchRef.current = { d: dist(e.touches[0], e.touches[1]), z: userZoom };
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current) {
            const d = dist(e.touches[0], e.touches[1]);
            const ratio = d / pinchRef.current.d;
            setUserZoom(Math.min(4, Math.max(0.5, +(pinchRef.current.z * ratio).toFixed(2))));
            e.preventDefault();
          }
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) pinchRef.current = null;
        }}
      >
      <div style={{ width: W * scale, height: H * scale, background: "#fff", margin: "0 auto" }}>
      <Stage
        ref={(s) => {
          stageInnerRef.current = s;
          if (stageRef) stageRef.current = s;
        }}
        width={W * scale}
        height={H * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(e) => {
          if (!editable) return;
          if (e.target === e.target.getStage()) setSelectedId(null);
        }}
        onTouchStart={(e) => {
          if (!editable) return;
          if (e.target === e.target.getStage()) setSelectedId(null);
        }}
      >
        <KLayer listening={false}>
          <Rect x={0} y={0} width={W} height={H} fill="#ffffff" />
          {bgImg && <KImage image={bgImg} x={0} y={0} width={W} height={H} />}
        </KLayer>
        <KLayer>
          {visibleLayers.map((rawLayer) => {
            const ov = adjustments?.[rawLayer.id];
            const layer = applyOverlay(rawLayer, ov);
            const commonProps = {
              id: layer.id,
              draggable: editable,
              listening: editable,
              onClick: () => handleSelect(layer.id),
              onTap: () => handleSelect(layer.id),
              onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
                commit(layer.id, { x: e.target.x(), y: e.target.y() });
              },
              onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
                const node = e.target;
                const sx = node.scaleX();
                const sy = node.scaleY();
                node.scaleX(1);
                node.scaleY(1);
                const textScaleX = layer.type === "text" ? ((layer as TextLayer).scaleXText ?? 1) : 1;
                const textScaleY = layer.type === "text" ? ((layer as TextLayer).scaleYText ?? 1) : 1;
                const newW = Math.max(8, ((layer as any).width * sx) / textScaleX);
                const newH = Math.max(8, ((layer as any).height * sy) / textScaleY);
                const upd: LayerOverlay = {
                  x: node.x(),
                  y: node.y(),
                  width: newW,
                  height: newH,
                  rotation: node.rotation(),
                };
                if (layer.type === "text" && (layer as TextLayer).autoFit !== false) {
                  upd.fontSize = Math.max(6, (layer as TextLayer).fontSize * ((sx + sy) / 2));
                }
                commit(layer.id, upd);
              },
            };

            if (layer.type === "text") {
              const t = layer as TextLayer;
              const fieldKey = fieldKeyOf(t);
              const { v } = resolveValues(t);
              const boundHasValue = hasBoundValue(v, fieldKey);
              const text = fieldKey ? v[fieldKey] : t.text;
              if (!boundHasValue) {
                return null;
              }
              if (!text || !String(text).trim()) return null;
              return (
                <Text
                  key={layer.id}
                  {...commonProps}
                  text={String(text)}
                  x={t.x}
                  y={t.y}
                  width={t.width}
                  height={t.height}
                  fontSize={t.fontSize}
                  fontFamily={t.fontFamily}
                  fontStyle={t.fontStyle}
                  lineHeight={t.lineHeight ?? 1.2}
                  letterSpacing={t.letterSpacing ?? 0}
                  scaleX={t.scaleXText ?? 1}
                  scaleY={t.scaleYText ?? 1}
                  fill={t.fill}
                  align={t.align}
                  verticalAlign="top"
                  direction={t.rtl ? "rtl" : "ltr"}
                  rotation={t.rotation}
                  opacity={t.opacity}
                  visible={t.visible}
                />
              );
            }

            if (layer.type === "image") {
              const im = layer as ImageLayer;
              const imageKey = fieldKeyOf(im);
              const { im: imMap } = resolveValues(im);
              const src = im.subtype === "asset" ? im.src : imMap[imageKey];
              return (
                <ImageNode
                  key={layer.id}
                  layer={im}
                  src={src ?? null}
                  editable={editable}
                  commonProps={commonProps}
                />
              );
            }


            if (layer.type === "line") {
              const ln = layer as LineLayer;
              return (
                <Line
                  key={layer.id}
                  {...commonProps}
                  x={ln.x}
                  y={ln.y}
                  points={[0, 0, ln.width, 0]}
                  stroke={ln.stroke}
                  strokeWidth={ln.strokeWidth}
                  rotation={ln.rotation}
                  opacity={ln.opacity}
                  visible={ln.visible}
                />
              );
            }

            const bx = layer as BoxLayer;
            return (
              <Rect
                key={layer.id}
                {...commonProps}
                x={bx.x}
                y={bx.y}
                width={bx.width}
                height={bx.height}
                fill={bx.fill}
                stroke={bx.stroke}
                strokeWidth={bx.strokeWidth}
                rotation={bx.rotation}
                opacity={bx.opacity}
                visible={bx.visible}
              />
            );
          })}
          {editable && (
            <Transformer
              ref={(n) => {
                trRef.current = n;
              }}
              rotateEnabled
              keepRatio={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 8 || newBox.height < 8) return oldBox;
                return newBox;
              }}
            />
          )}
        </KLayer>
      </Stage>
      </div>
      </div>
    </div>
  );
}


function ImageNode({
  layer,
  src,
  editable,
  commonProps,
}: {
  layer: ImageLayer;
  src: string | null;
  editable: boolean;
  commonProps: any;
}) {
  const img = useHTMLImage(src);
  if (!img) {
    return null;
  }
  const effectiveFit: ImageLayer["fit"] = layer.faceCrop === "keep_inside" ? "contain" : layer.fit;
  const fitted = fitRect(img.width, img.height, layer.width, layer.height, effectiveFit, layer.faceCrop);
  return (
    <Group
      {...commonProps}
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      clipX={0}
      clipY={0}
      clipWidth={layer.width}
      clipHeight={layer.height}
    >
      <KImage image={img} x={fitted.x} y={fitted.y} width={fitted.w} height={fitted.h} />
    </Group>
  );
}
