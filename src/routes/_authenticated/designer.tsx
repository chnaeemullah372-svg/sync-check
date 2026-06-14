import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState, useEffect } from "react";
import { z } from "zod";
import type Konva from "konva";
import { consumeStagedPsd } from "@/lib/designer/psd-staging";
import { Toolbar } from "@/components/designer/Toolbar";
import { LayerPanel } from "@/components/designer/LayerPanel";
import { PropertiesPanel } from "@/components/designer/PropertiesPanel";
import { LeftTools } from "@/components/designer/LeftTools";
import { RightTools } from "@/components/designer/RightTools";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Layers, SlidersHorizontal, PanelRightOpen, Plus, Minus, Maximize2 } from "lucide-react";
import { A4_PORTRAIT, useDesigner, makeId } from "@/lib/designer/store";
import type { Layer } from "@/lib/designer/types";
import { useDesignerAutosave } from "@/hooks/use-designer-autosave";
import { useServerFn } from "@tanstack/react-start";
import { loadTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";

const DesignerCanvas = lazy(() =>
  import("@/components/designer/Canvas").then((m) => ({ default: m.DesignerCanvas })),
);

// Standard ID card portrait, 300dpi-ish workspace
const CARD = { w: 638, h: 1012 };

export const Route = createFileRoute("/_authenticated/designer")({
  validateSearch: (search) =>
    z
      .object({
        tid: z.string().uuid().optional(),
        mode: z.enum(["card", "onepage", "member", "psd", "frc"]).optional(),
        editor: z.enum(["user"]).optional(),
        entryId: z.string().uuid().optional(),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Template Designer" },
      { name: "description", content: "Photoshop-style template designer." },
      // Disable browser pinch-zoom of the whole UI; we handle pinch on the canvas only.
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
    ],
  }),
  component: DesignerPage,
});

function memberStarterLayers(count: number = 1): Layer[] {
  const layers: Layer[] = [];
  // Compact row per member: photo + name/father/cnic/dob/relation
  for (let i = 1; i <= count; i++) {
    const yOff = (i - 1) * 200;
    layers.push(
      { id: makeId(), name: `Photo Box ${i}`, type: "image", x: 60, y: 80 + yOff, width: 100, height: 125, rotation: 0, opacity: 1, visible: true, locked: false, src: null, fit: "crop", subtype: "photo", fieldKey: "photo", slotIndex: i },
      { id: makeId(), name: `Name ${i}`, type: "text", x: 180, y: 90 + yOff, width: 280, height: 28, rotation: 0, opacity: 1, visible: true, locked: false, text: "Name", fontSize: 18, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "name", slotIndex: i },
      { id: makeId(), name: `Father Name ${i}`, type: "text", x: 180, y: 122 + yOff, width: 280, height: 26, rotation: 0, opacity: 1, visible: true, locked: false, text: "Father Name", fontSize: 16, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "father_name", slotIndex: i },
      { id: makeId(), name: `CNIC ${i}`, type: "text", x: 180, y: 150 + yOff, width: 200, height: 24, rotation: 0, opacity: 1, visible: true, locked: false, text: "CNIC", fontSize: 14, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "cnic", slotIndex: i },
      { id: makeId(), name: `DOB ${i}`, type: "text", x: 390, y: 150 + yOff, width: 140, height: 24, rotation: 0, opacity: 1, visible: true, locked: false, text: "DOB", fontSize: 14, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "dob", slotIndex: i },
      { id: makeId(), name: `Relation ${i}`, type: "text", x: 540, y: 150 + yOff, width: 150, height: 24, rotation: 0, opacity: 1, visible: true, locked: false, text: "Relation", fontSize: 14, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "relation", slotIndex: i },
    );
  }
  return layers;
}

/**
 * FRC (Family Registration Certificate, NADRA) starter.
 * Applicant block (slot 1) + 4 member blocks (slots 2..5).
 * Each block has English label, Urdu label, value text, and editable position.
 */
function frcStarterLayers(): Layer[] {
  const W = A4_PORTRAIT.w;
  const layers: Layer[] = [];

  // Header static
  layers.push(
    { id: makeId(), name: "Title (EN)", type: "text", x: 40, y: 40, width: W - 80, height: 30, rotation: 0, opacity: 1, visible: true, locked: false, text: "FAMILY REGISTRATION CERTIFICATE", fontSize: 18, fontFamily: "Arial", fontStyle: "bold", fill: "#0b6e3f", align: "left", slotIndex: 0 },
    { id: makeId(), name: "Subtitle (EN)", type: "text", x: 40, y: 72, width: W - 80, height: 22, rotation: 0, opacity: 1, visible: true, locked: false, text: "Government of Pakistan — NADRA", fontSize: 12, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", slotIndex: 0 },
  );

  // Block builder: English label + Urdu label + value field
  const FIELDS: Array<{ key: import("@/lib/designer/types").FieldKey; en: string; ur: string }> = [
    { key: "name", en: "Full Name", ur: "پورا نام" },
    { key: "cnic", en: "Citizen Number", ur: "شناختی نمبر" },
    { key: "dob", en: "Date Of Birth", ur: "تاریخ پیدائش" },
    { key: "father_name", en: "Father Name", ur: "والد کا نام" },
    { key: "mother_name", en: "Mother Name", ur: "والدہ کا نام" },
    { key: "relation", en: "Relation", ur: "رشتہ" },
  ];

  const blockHeight = 180;
  const startY = 120;

  // 5 slots: 1 = Applicant/Self, 2..5 = members
  for (let slot = 1; slot <= 5; slot++) {
    const blockY = startY + (slot - 1) * blockHeight;
    const heading = slot === 1 ? "Applicant" : `Member ${slot - 1}`;
    const headingUr = slot === 1 ? "درخواست دہندہ" : `فرد ${slot - 1}`;

    layers.push(
      { id: makeId(), name: `${heading} heading`, type: "text", x: 40, y: blockY, width: 300, height: 22, rotation: 0, opacity: 1, visible: true, locked: false, text: heading, fontSize: 13, fontFamily: "Arial", fontStyle: "bold", fill: "#0b6e3f", align: "left", slotIndex: slot },
      { id: makeId(), name: `${heading} heading (UR)`, type: "text", x: W - 340, y: blockY, width: 300, height: 22, rotation: 0, opacity: 1, visible: true, locked: false, text: headingUr, fontSize: 13, fontFamily: "Noto Nastaliq Urdu", fontStyle: "bold", fill: "#0b6e3f", align: "right", rtl: true, slotIndex: slot },
      // Divider line proxy as a thin box
      { id: makeId(), name: `${heading} rule`, type: "box", x: 40, y: blockY + 24, width: W - 80, height: 1, rotation: 0, opacity: 1, visible: true, locked: false, fill: "#0b6e3f", stroke: "#0b6e3f", strokeWidth: 0, slotIndex: slot },
    );

    FIELDS.forEach((f, idx) => {
      const row = idx;
      const rowY = blockY + 30 + row * 22;
      // English label
      layers.push({ id: makeId(), name: `${heading} ${f.en} label`, type: "text", x: 40, y: rowY, width: 130, height: 20, rotation: 0, opacity: 1, visible: true, locked: false, text: `${f.en}:`, fontSize: 11, fontFamily: "Arial", fontStyle: "bold", fill: "#374151", align: "left", slotIndex: slot });
      // Value
      layers.push({ id: makeId(), name: `${heading} ${f.en}`, type: "text", x: 175, y: rowY, width: 320, height: 20, rotation: 0, opacity: 1, visible: true, locked: false, text: "", fontSize: 11, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: f.key, slotIndex: slot });
      // Urdu label
      layers.push({ id: makeId(), name: `${heading} ${f.ur}`, type: "text", x: W - 170, y: rowY, width: 130, height: 20, rotation: 0, opacity: 1, visible: true, locked: false, text: f.ur, fontSize: 11, fontFamily: "Noto Nastaliq Urdu", fontStyle: "normal", fill: "#374151", align: "right", rtl: true, slotIndex: slot });
    });
  }

  return layers;
}

function DesignerPage() {
  const { tid, mode, editor, entryId } = Route.useSearch();
  const userMode = editor === "user";
  const stageRef = useRef<Konva.Stage | null>(null);
  const [mounted, setMounted] = useState(false);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  // Skip autosave hydration when opening a saved template, a mode preset, or in user-edit mode
  useDesignerAutosave({ skipHydrate: !!tid || !!mode || userMode });

  const loadTemplateFn = useServerFn(loadTemplate);

  // Apply mode preset on first mount (only when there's no tid)
  useEffect(() => {
    if (tid || !mode) return;
    const st = useDesigner.getState();
    if (mode === "card") {
      st.loadState({ background: { src: null, width: CARD.w, height: CARD.h }, canvasWidth: CARD.w, canvasHeight: CARD.h, layers: [], memberNames: {} });
      st.setSize("custom", CARD.w, CARD.h);
      toast.success("Card template");
    } else if (mode === "onepage") {
      st.loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: [], memberNames: {} });
      st.setSize("a4p");
      toast.success("One-page A4 template");
    } else if (mode === "member") {
      let count = 1;
      try { count = Math.max(1, Math.min(20, parseInt(sessionStorage.getItem("designer.memberCount") || "1", 10))); } catch { /* ignore */ }
      const names: Record<number, string> = {};
      for (let i = 1; i <= count; i++) names[i] = `Member ${i}`;
      st.loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: memberStarterLayers(count), memberNames: names });
      st.setSize("a4p");
      try { sessionStorage.removeItem("designer.memberCount"); } catch { /* ignore */ }
      toast.success(`${count}-member starter loaded`);
    } else if (mode === "frc") {
      const names: Record<number, string> = { 1: "Applicant", 2: "Member 1", 3: "Member 2", 4: "Member 3", 5: "Member 4" };
      st.loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: frcStarterLayers(), memberNames: names });
      st.setSize("a4p");
      toast.success("FRC (NADRA) starter loaded");
    } else if (mode === "psd") {
      try {
        const p = consumeStagedPsd();
        if (!p) { toast.error("PSD data not found — please re-import"); return; }
        const layers: Layer[] = (p.layers || []).map((l: any) => {
          if (l.type === "text") {
            return {
              id: l.id || makeId(), name: l.name || "Text", type: "text" as const,
              x: l.x, y: l.y, width: l.width, height: l.height,
              rotation: 0, opacity: 1, visible: true, locked: false,
              text: l.text || "", fontSize: l.fontSize || 24, fontFamily: l.fontFamily || "Arial",
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
        // Base load from server template
        let baseState = {
          background: snap.background ?? { src: template.background_url ?? null, width: template.width, height: template.height },
          canvasWidth: template.width,
          canvasHeight: template.height,
          layers: snap.layers || [],
          memberNames: snap.memberNames || {},
        };
        // In user-edit mode, overlay any saved per-entry customization
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
              toast.info("Loaded your saved edits");
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
  }, [tid, loadTemplateFn, mode, userMode, entryId]);


  const { zoomIn, zoomOut, zoomReset, userZoom } = useDesigner();

  const canvas = mounted ? (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground">Loading canvas…</div>}>
      <DesignerCanvas stageRef={stageRef} />
    </Suspense>
  ) : (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading canvas…</div>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b px-3 py-1.5 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-bold">Template Designer</h1>
        <span className="hidden sm:inline text-[11px] text-muted-foreground">Photoshop-style</span>
      </header>
      <Toolbar stageRef={stageRef} userMode={userMode} entryId={entryId} />

      {/* Unified single-page layout: rails on edges, canvas centered. */}
      <div className="flex-1 flex overflow-hidden relative">
        <LeftTools />

        {/* Properties panel — fixed rail on desktop, drawer on mobile/tablet */}
        <div className="hidden xl:flex h-full">
          <PropertiesPanel />
        </div>

        {/* Centered canvas area with floating zoom controls */}
        <div className="flex-1 flex overflow-hidden relative">
          {canvas}

          {/* Floating zoom controls (always visible) */}
          <div className="absolute left-2 bottom-3 z-20 flex flex-col items-center bg-card border rounded-md shadow-md">
            <button
              onClick={zoomIn}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-t-md"
              title="Zoom in"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={zoomReset}
              className="h-6 w-8 text-[10px] hover:bg-accent border-y"
              title="Reset zoom"
            >
              {Math.round(userZoom * 100)}%
            </button>
            <button
              onClick={zoomOut}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent"
              title="Zoom out"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={zoomReset}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-b-md border-t"
              title="Fit"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Layers panel — fixed rail on desktop, drawer on mobile/tablet */}
        {!layersCollapsed && (
          <div className="hidden xl:flex h-full">
            <LayerPanel onCollapse={() => setLayersCollapsed(true)} />
          </div>
        )}
        {layersCollapsed && (
          <button
            onClick={() => setLayersCollapsed(false)}
            className="hidden xl:flex absolute right-12 top-2 z-20 items-center gap-1 px-2 h-8 bg-card border rounded shadow text-xs hover:bg-accent"
            title="Show layer panel"
          >
            <PanelRightOpen className="w-3.5 h-3.5" /> Layers
          </button>
        )}

        <RightTools />

        {/* Mobile/tablet floating toggles for Props + Layers */}
        <div className="xl:hidden absolute bottom-3 right-16 flex flex-col gap-2 z-20">
          <Sheet open={mobileLayersOpen} onOpenChange={setMobileLayersOpen}>
            <SheetTrigger asChild>
              <Button size="icon" className="h-11 w-11 rounded-full shadow-lg" title="Layers">
                <Layers className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[88vw] sm:w-[420px] max-w-md flex flex-col">
              <LayerPanel mobile onCollapse={() => setMobileLayersOpen(false)} />
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="secondary" className="h-11 w-11 rounded-full shadow-lg" title="Properties">
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[88vw] sm:w-[420px] max-w-md overflow-y-auto">
              <PropertiesPanel mobile />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
