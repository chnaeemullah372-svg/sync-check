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
  FontSheet,
  FontSizeSheet,
  ColorSheet,
  PositionSheet,
  AlignSheet,
  AIFieldSheet,
  AIInstructionsSheet,
  LayersSheet,
  BackgroundSheet,
  PageSizeSheet,
  UploadsSheet,
} from "@/components/designer/canva/Sheets";
import { LeftToolbar } from "@/components/designer/canva/LeftToolbar";

const DesignerCanvas = lazy(() =>
  import("@/components/designer/Canvas").then((m) => ({ default: m.DesignerCanvas })),
);

const CARD = { w: 638, h: 1012 };

type ImportedPsdLayer = {
  id?: string;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  src?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  rtl?: boolean;
  originalFontFamily?: string;
  fontMissing?: boolean;
  autoFit?: boolean;
  lineHeight?: number;
  scaleXText?: number;
};

type DesignerSnapshot = {
  background?: { src: string | null; width: number; height: number };
  canvasWidth?: number;
  canvasHeight?: number;
  layers?: Layer[];
  memberNames?: Record<number, string>;
};

export const Route = createFileRoute("/_authenticated/designer")({
  validateSearch: (search) =>
    z
      .object({
        tid: z.string().uuid().optional(),
        mode: z.enum(["card", "onepage", "member", "psd", "frc", "blank"]).optional(),
        editor: z.enum(["user"]).optional(),
        entryId: z.string().uuid().optional(),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Template Designer" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
    ],
  }),
  component: DesignerPage,
});

function memberStarterLayers(count: number = 1): Layer[] {
  // Clean VIP-style member table — max 10 rows per page so each row stays clearly readable.
  // If the user picked more than 10 members, the entry preview auto-paginates extras
  // by repeating this same slot layout on additional pages (no mixed rows across pages).
  const layers: Layer[] = [];
  const slotCount = Math.min(Math.max(count, 1), 10);

  const COL = {
    photo: { x: 18, w: 70 },
    name: { x: 100, w: 220 },
    cnic: { x: 328, w: 188 },
    dob: { x: 524, w: 110 },
    relation: { x: 642, w: 134 },
  };
  const HEADER_Y = 86;
  const HEADER_H = 30;
  const ROW_TOP = 120;
  const ROW_H = 92;

  layers.push(
    {
      id: makeId(),
      name: "Title Bar",
      type: "box",
      x: 18,
      y: 22,
      width: 758,
      height: 46,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: "#0F172A",
      stroke: "transparent",
      strokeWidth: 0,
      slotIndex: 0,
    } as Layer,
    {
      id: makeId(),
      name: "Title",
      type: "text",
      x: 18,
      y: 30,
      width: 758,
      height: 30,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: "FAMILY MEMBERS",
      fontSize: 20,
      fontFamily: "Arial",
      fontStyle: "bold",
      fill: "#ffffff",
      align: "center",
      slotIndex: 0,
    } as Layer,
    {
      id: makeId(),
      name: "Header BG",
      type: "box",
      x: 18,
      y: HEADER_Y,
      width: 758,
      height: HEADER_H,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: "#E2E8F0",
      stroke: "#94A3B8",
      strokeWidth: 1,
      slotIndex: 0,
    } as Layer,
  );
  const headers: Array<[string, { x: number; w: number }]> = [
    ["Photo", COL.photo],
    ["Name", COL.name],
    ["CNIC", COL.cnic],
    ["D.O.B", COL.dob],
    ["Relation", COL.relation],
  ];
  for (const [label, c] of headers) {
    layers.push({
      id: makeId(),
      name: `Header ${label}`,
      type: "text",
      x: c.x,
      y: HEADER_Y + 7,
      width: c.w,
      height: 20,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: label,
      fontSize: 12,
      fontFamily: "Arial",
      fontStyle: "bold",
      fill: "#0F172A",
      align: "center",
      slotIndex: 0,
    } as Layer);
  }

  for (let i = 1; i <= slotCount; i++) {
    const y = ROW_TOP + (i - 1) * ROW_H;
    const isFirst = i === 1;
    const relationDefault = isFirst ? "Self" : "Relation";
    layers.push(
      {
        id: makeId(),
        name: `Row ${i} Border`,
        type: "box",
        x: 18,
        y,
        width: 758,
        height: ROW_H,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fill: "transparent",
        stroke: "#CBD5E1",
        strokeWidth: 1,
        slotIndex: i,
      } as Layer,
      {
        id: makeId(),
        name: `Photo ${i}`,
        type: "image",
        x: COL.photo.x + 4,
        y: y + 6,
        width: COL.photo.w - 8,
        height: ROW_H - 12,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        src: null,
        fit: "crop",
        subtype: "photo",
        fieldKey: "photo",
        faceCrop: "passport",
        slotIndex: i,
      } as Layer,
      {
        id: makeId(),
        name: `Name ${i}`,
        type: "text",
        x: COL.name.x + 4,
        y: y + ROW_H / 2 - 12,
        width: COL.name.w - 8,
        height: 24,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: "Name",
        fontSize: 14,
        fontFamily: "Arial",
        fontStyle: "bold",
        fill: "#0F172A",
        align: "left",
        fieldKey: "name",
        slotIndex: i,
      } as Layer,
      {
        id: makeId(),
        name: `CNIC ${i}`,
        type: "text",
        x: COL.cnic.x + 4,
        y: y + ROW_H / 2 - 10,
        width: COL.cnic.w - 8,
        height: 20,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: "CNIC",
        fontSize: 12,
        fontFamily: "Arial",
        fontStyle: "normal",
        fill: "#0F172A",
        align: "left",
        fieldKey: "cnic",
        slotIndex: i,
      } as Layer,
      {
        id: makeId(),
        name: `DOB ${i}`,
        type: "text",
        x: COL.dob.x + 4,
        y: y + ROW_H / 2 - 10,
        width: COL.dob.w - 8,
        height: 20,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: "DOB",
        fontSize: 12,
        fontFamily: "Arial",
        fontStyle: "normal",
        fill: "#1F2937",
        align: "left",
        fieldKey: "dob",
        slotIndex: i,
      } as Layer,
      {
        id: makeId(),
        name: `Relation ${i}`,
        type: "text",
        x: COL.relation.x + 4,
        y: y + ROW_H / 2 - 10,
        width: COL.relation.w - 8,
        height: 20,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: relationDefault,
        fontSize: 13,
        fontFamily: "Arial",
        fontStyle: "bold",
        fill: isFirst ? "#0369A1" : "#1F2937",
        align: "center",
        fieldKey: "relation",
        slotIndex: i,
      } as Layer,
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

  // Mode presets — guarded so React strict-mode double-invoke does not
  // re-consume the staged PSD (which would null it and toast "PSD data not found").
  const modeAppliedRef = useRef(false);
  useEffect(() => {
    if (tid || !mode) return;
    if (modeAppliedRef.current) return;
    modeAppliedRef.current = true;
    const st = useDesigner.getState();
    if (mode === "card") {
      st.loadState({
        background: { src: null, width: CARD.w, height: CARD.h },
        canvasWidth: CARD.w,
        canvasHeight: CARD.h,
        layers: [],
        memberNames: {},
      });
      st.setSize("custom", CARD.w, CARD.h);
    } else if (mode === "onepage") {
      st.loadState({
        background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h },
        canvasWidth: A4_PORTRAIT.w,
        canvasHeight: A4_PORTRAIT.h,
        layers: [],
        memberNames: {},
      });
      st.setSize("a4p");
    } else if (mode === "blank") {
      const b = consumeStagedBlank();
      if (b) {
        if (b.fitMode === "auto") {
          st.loadState({
            background: { src: b.src, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h },
            canvasWidth: A4_PORTRAIT.w,
            canvasHeight: A4_PORTRAIT.h,
            layers: [],
            memberNames: {},
          });
          st.setSize("a4p");
        } else {
          st.loadState({
            background: { src: b.src, width: b.width, height: b.height },
            canvasWidth: b.width,
            canvasHeight: b.height,
            layers: [],
            memberNames: {},
          });
          st.setSize("custom", b.width, b.height);
        }
        toast.success(
          `Background loaded (${b.fitMode === "auto" ? "fit A4" : `${b.width}×${b.height}`})`,
        );
      } else {
        st.loadState({
          background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h },
          canvasWidth: A4_PORTRAIT.w,
          canvasHeight: A4_PORTRAIT.h,
          layers: [],
          memberNames: {},
        });
        st.setSize("a4p");
      }
    } else if (mode === "member") {
      let count = 1;
      try {
        count = Math.max(
          1,
          Math.min(20, parseInt(sessionStorage.getItem("designer.memberCount") || "1", 10)),
        );
      } catch {
        /* ignore */
      }
      const names: Record<number, string> = {};
      for (let i = 1; i <= count; i++) names[i] = `Member ${i}`;
      st.loadState({
        background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h },
        canvasWidth: A4_PORTRAIT.w,
        canvasHeight: A4_PORTRAIT.h,
        layers: memberStarterLayers(count),
        memberNames: names,
      });
      st.setSize("a4p");
      try {
        sessionStorage.removeItem("designer.memberCount");
      } catch {
        /* ignore */
      }
    } else if (mode === "psd") {
      void (async () => {
      try {
        const p = await consumeStagedPsd();
        if (!p) {
          toast.error("PSD data not found");
          return;
        }
        const importedLayers = (p.layers || []) as ImportedPsdLayer[];
        const layers: Layer[] = importedLayers.map((l) => {
          if (l.type === "text") {
            return {
              id: l.id || makeId(),
              name: l.name || "Text",
              type: "text" as const,
              x: l.x ?? 0,
              y: l.y ?? 0,
              width: l.width ?? 120,
              height: l.height ?? 32,
              rotation: l.rotation || 0,
              opacity: 1,
              visible: true,
              locked: false,
              text: l.text || "",
              fontSize: l.fontSize || 24,
              fontFamily: l.fontFamily || "Inter",
              fontStyle: l.fontStyle || "normal",
              fill: l.fill || "#111827",
              align: l.align || ("left" as const),
              rtl: !!l.rtl,
              originalFontFamily: l.originalFontFamily,
              fontMissing: !!l.fontMissing,
              autoFit: l.originalFontFamily || l.fontMissing ? false : (l.autoFit ?? true),
              lineHeight: l.lineHeight ?? 1.2,
              scaleXText: l.scaleXText ?? 1,
            };
          }
          return {
            id: l.id || makeId(),
            name: l.name || "Layer",
            type: "image" as const,
            x: l.x ?? 0,
            y: l.y ?? 0,
            width: l.width ?? 120,
            height: l.height ?? 120,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            src: l.src ?? null,
            fit: "stretch" as const,
            subtype: "asset" as const,
          };
        });
        st.loadState({
          background: { src: p.background ?? null, width: p.width, height: p.height },
          canvasWidth: p.width,
          canvasHeight: p.height,
          layers,
          memberNames: {},
        });
        st.setSize("custom", p.width, p.height);
        toast.success(`PSD imported — ${layers.length} layers`);
      } catch (e: unknown) {
        toast.error(`PSD load failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load template by id
  useEffect(() => {
    if (!tid) {
      if (!mode) {
        try {
          sessionStorage.removeItem("designer.currentTemplateId");
          sessionStorage.removeItem("designer.currentTemplateName");
        } catch {
          /* ignore */
        }
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { template, snapshot } = await loadTemplateFn({ data: { templateId: tid } });
        if (cancelled || !template) return;
        const snap = (snapshot || {}) as DesignerSnapshot;
        let baseState = {
          background: snap.background ?? {
            src: template.background_url ?? null,
            width: template.width,
            height: template.height,
          },
          canvasWidth: template.width,
          canvasHeight: template.height,
          layers: snap.layers || [],
          memberNames: snap.memberNames || {},
        };
        if (userMode && entryId) {
          try {
            const raw = localStorage.getItem(`designer.userEdit.${entryId}`);
            if (raw) {
              const p = JSON.parse(raw) as DesignerSnapshot;
              baseState = {
                background: p.background ?? baseState.background,
                canvasWidth: p.canvasWidth ?? baseState.canvasWidth,
                canvasHeight: p.canvasHeight ?? baseState.canvasHeight,
                layers: p.layers ?? baseState.layers,
                memberNames: p.memberNames ?? baseState.memberNames,
              };
            }
          } catch {
            /* ignore */
          }
        }
        useDesigner.getState().loadState(baseState);
        try {
          if (!userMode) {
            sessionStorage.setItem("designer.currentTemplateId", tid);
            sessionStorage.setItem("designer.currentTemplateName", template.name);
          }
        } catch {
          /* ignore */
        }
        if (!userMode) toast.success(`Loaded "${template.name}"`);
      } catch (e: unknown) {
        toast.error(`Template load failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tid, loadTemplateFn, userMode, entryId]);

  const canvas = mounted ? (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading canvas…
        </div>
      }
    >
      <DesignerCanvas stageRef={stageRef} />
    </Suspense>
  ) : (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      Loading canvas…
    </div>
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
