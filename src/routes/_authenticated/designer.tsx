import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState, useEffect } from "react";
import { z } from "zod";
import type Konva from "konva";
import { consumeStagedPsd } from "@/lib/designer/psd-staging";
import { consumeStagedBlank } from "@/lib/designer/blank-staging";
import { A4_PORTRAIT, useDesigner, makeId } from "@/lib/designer/store";
import type { Layer } from "@/lib/designer/types";
import { useDesignerAutosave } from "@/hooks/use-designer-autosave";
import { useServerFn } from "@tanstack/react-start";
import { loadTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";
import { CanvaTopBar } from "@/components/designer/canva/TopBar";
import { BottomDock } from "@/components/designer/canva/BottomDock";
import { DockProvider } from "@/components/designer/canva/dockState";
import {
  FontSheet, FontSizeSheet, ColorSheet, PositionSheet, AlignSheet,
  AIFieldSheet, AIInstructionsSheet, LayersSheet, BackgroundSheet, PageSizeSheet, UploadsSheet,
} from "@/components/designer/canva/Sheets";
import { LeftToolbar } from "@/components/designer/canva/LeftToolbar";

const DesignerCanvas = lazy(() =>
  import("@/components/designer/Canvas").then((m) => ({ default: m.DesignerCanvas })),
);

const CARD = { w: 638, h: 1012 };

export const Route = createFileRoute("/_authenticated/designer")({
  validateSearch: (search) =>
    z.object({
      tid: z.string().uuid().optional(),
      mode: z.enum(["card", "onepage", "member", "psd", "frc", "blank"]).optional(),
      editor: z.enum(["user"]).optional(),
      entryId: z.string().uuid().optional(),
    }).parse(search),
  head: () => ({
    meta: [
      { title: "Template Designer" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
    ],
  }),
  component: DesignerPage,
});

function memberStarterLayers(count: number = 1): Layer[] {
  const layers: Layer[] = [];
  for (let i = 1; i <= count; i++) {
    const yOff = (i - 1) * 200;
    layers.push(
      { id: makeId(), name: `Photo ${i}`, type: "image", x: 60, y: 80 + yOff, width: 100, height: 125, rotation: 0, opacity: 1, visible: true, locked: false, src: null, fit: "crop", subtype: "photo", fieldKey: "photo", slotIndex: i },
      { id: makeId(), name: `Name ${i}`, type: "text", x: 180, y: 90 + yOff, width: 280, height: 28, rotation: 0, opacity: 1, visible: true, locked: false, text: "Name", fontSize: 18, fontFamily: "Inter", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "name", slotIndex: i },
      { id: makeId(), name: `Father Name ${i}`, type: "text", x: 180, y: 122 + yOff, width: 280, height: 26, rotation: 0, opacity: 1, visible: true, locked: false, text: "Father Name", fontSize: 16, fontFamily: "Inter", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "father_name", slotIndex: i },
      { id: makeId(), name: `CNIC ${i}`, type: "text", x: 180, y: 150 + yOff, width: 200, height: 24, rotation: 0, opacity: 1, visible: true, locked: false, text: "CNIC", fontSize: 14, fontFamily: "Inter", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "cnic", slotIndex: i },
    );
  }
  return layers;
}

function DesignerPage() {
  const { tid, mode, editor, entryId } = Route.useSearch();
  const userMode = editor === "user";
  const stageRef = useRef<Konva.Stage | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useDesignerAutosave({ skipHydrate: !!tid || !!mode || userMode });

  const loadTemplateFn = useServerFn(loadTemplate);

  // Mode presets
  useEffect(() => {
    if (tid || !mode) return;
    const st = useDesigner.getState();
    if (mode === "card") {
      st.loadState({ background: { src: null, width: CARD.w, height: CARD.h }, canvasWidth: CARD.w, canvasHeight: CARD.h, layers: [], memberNames: {} });
      st.setSize("custom", CARD.w, CARD.h);
    } else if (mode === "onepage") {
      st.loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: [], memberNames: {} });
      st.setSize("a4p");
    } else if (mode === "blank") {
      const b = consumeStagedBlank();
      if (b) {
        if (b.fitMode === "auto") {
          st.loadState({ background: { src: b.src, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: [], memberNames: {} });
          st.setSize("a4p");
        } else {
          st.loadState({ background: { src: b.src, width: b.width, height: b.height }, canvasWidth: b.width, canvasHeight: b.height, layers: [], memberNames: {} });
          st.setSize("custom", b.width, b.height);
        }
        toast.success(`Background loaded (${b.fitMode === "auto" ? "fit A4" : `${b.width}×${b.height}`})`);
      } else {
        st.loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: [], memberNames: {} });
        st.setSize("a4p");
      }
    } else if (mode === "member") {
      let count = 1;
      try { count = Math.max(1, Math.min(20, parseInt(sessionStorage.getItem("designer.memberCount") || "1", 10))); } catch { /* ignore */ }
      const names: Record<number, string> = {};
      for (let i = 1; i <= count; i++) names[i] = `Member ${i}`;
      st.loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: memberStarterLayers(count), memberNames: names });
      st.setSize("a4p");
      try { sessionStorage.removeItem("designer.memberCount"); } catch { /* ignore */ }
    } else if (mode === "psd") {
      try {
        const p = consumeStagedPsd();
        if (!p) { toast.error("PSD data not found"); return; }
        const layers: Layer[] = (p.layers || []).map((l: any) => {
          if (l.type === "text") {
            return {
              id: l.id || makeId(), name: l.name || "Text", type: "text" as const,
              x: l.x, y: l.y, width: l.width, height: l.height,
              rotation: 0, opacity: 1, visible: true, locked: false,
              text: l.text || "", fontSize: l.fontSize || 24, fontFamily: l.fontFamily || "Inter",
              fontStyle: "normal", fill: l.fill || "#111827", align: "left" as const,
            };
          }
          return {
            id: l.id || makeId(), name: l.name || "Layer", type: "image" as const,
            x: l.x, y: l.y, width: l.width, height: l.height,
            rotation: 0, opacity: 1, visible: true, locked: false,
            src: l.src, fit: "stretch" as const, subtype: "asset" as const,
          };
        });
        st.loadState({ background: { src: p.background ?? null, width: p.width, height: p.height }, canvasWidth: p.width, canvasHeight: p.height, layers, memberNames: {} });
        st.setSize("custom", p.width, p.height);
        toast.success(`PSD imported — ${layers.length} layers`);
      } catch (e: any) {
        toast.error(`PSD load failed: ${e?.message || e}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load template by id
  useEffect(() => {
    if (!tid) {
      if (!mode) {
        try { sessionStorage.removeItem("designer.currentTemplateId"); sessionStorage.removeItem("designer.currentTemplateName"); } catch { /* ignore */ }
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { template, snapshot } = await loadTemplateFn({ data: { templateId: tid } });
        if (cancelled || !template) return;
        const snap: any = snapshot || {};
        let baseState = {
          background: snap.background ?? { src: template.background_url ?? null, width: template.width, height: template.height },
          canvasWidth: template.width, canvasHeight: template.height,
          layers: snap.layers || [], memberNames: snap.memberNames || {},
        };
        if (userMode && entryId) {
          try {
            const raw = localStorage.getItem(`designer.userEdit.${entryId}`);
            if (raw) {
              const p = JSON.parse(raw);
              baseState = {
                background: p.background ?? baseState.background,
                canvasWidth: p.canvasWidth ?? baseState.canvasWidth,
                canvasHeight: p.canvasHeight ?? baseState.canvasHeight,
                layers: p.layers ?? baseState.layers,
                memberNames: p.memberNames ?? baseState.memberNames,
              };
            }
          } catch { /* ignore */ }
        }
        useDesigner.getState().loadState(baseState);
        try {
          if (!userMode) {
            sessionStorage.setItem("designer.currentTemplateId", tid);
            sessionStorage.setItem("designer.currentTemplateName", template.name);
          }
        } catch { /* ignore */ }
        if (!userMode) toast.success(`Loaded "${template.name}"`);
      } catch (e: any) {
        toast.error(`Template load failed: ${e?.message || e}`);
      }
    })();
    return () => { cancelled = true; };
  }, [tid, loadTemplateFn, userMode, entryId]);

  const canvas = mounted ? (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground">Loading canvas…</div>}>
      <DesignerCanvas stageRef={stageRef} />
    </Suspense>
  ) : (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading canvas…</div>
  );

  return (
    <DockProvider>
      <div className="h-[100svh] flex flex-col bg-background overflow-hidden">
        <CanvaTopBar userMode={userMode} entryId={entryId} />
        <div className="flex-1 flex overflow-hidden relative">
          {canvas}
          {!userMode && <LeftToolbar />}
        </div>
        <BottomDock />
        {/* Sheets */}
        <FontSheet />
        <FontSizeSheet />
        <ColorSheet />
        <PositionSheet />
        <AlignSheet />
        <AIFieldSheet />
        <AIInstructionsSheet />
        <LayersSheet />
        <BackgroundSheet />
        <PageSizeSheet />
        <UploadsSheet />
      </div>
    </DockProvider>
  );
}
