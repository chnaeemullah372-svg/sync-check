import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setStagedPsd } from "@/lib/designer/psd-staging";
import { setStagedBlank } from "@/lib/designer/blank-staging";
import { FONT_LIBRARY } from "@/lib/designer/fonts";
import {
  isCustomFontAvailable,
  loadCustomFontsOnce,
  resolveCustomFontFamily,
} from "@/hooks/use-custom-fonts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  FileText,
  Users as UsersIcon,
  FileImage,
  Loader2,
  ScrollText,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export type NewTemplateMode = "card" | "onepage" | "member" | "psd" | "frc" | "blank";
export type MemberCount = number; // 1..20

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const OPTIONS: {
  id: NewTemplateMode;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}[] = [
  {
    id: "card",
    title: "Card",
    desc: "ID card size canvas. Single static card — no member slots.",
    icon: CreditCard,
    tint: "bg-rose-50 text-rose-600",
  },
  {
    id: "onepage",
    title: "One-Page",
    desc: "Blank A4 portrait, full-page document layout.",
    icon: FileText,
    tint: "bg-blue-50 text-blue-600",
  },
  {
    id: "member",
    title: "Member-based",
    desc: "A4 page with 1–4 member slots (photo, name, CNIC…).",
    icon: UsersIcon,
    tint: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "frc",
    title: "FRC (NADRA)",
    desc: "Family Registration Certificate — Applicant + 4 members, English + Urdu labels.",
    icon: ScrollText,
    tint: "bg-green-50 text-green-700",
  },
  {
    id: "blank",
    title: "Blank Template",
    desc: "Upload an image (PNG/JPG) as background — fit to A4 or keep original size.",
    icon: ImageIcon,
    tint: "bg-violet-50 text-violet-600",
  },
  {
    id: "psd",
    title: "Import PSD",
    desc: "Upload a .psd file — full project comes in as editable layers.",
    icon: FileImage,
    tint: "bg-amber-50 text-amber-600",
  },
];

const SYSTEM_FONTS = new Set([
  "Arial",
  "Arial Black",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Impact",
  "Calibri",
  "Cambria",
  "Candara",
  "Century Gothic",
  "Franklin Gothic Medium",
  "Garamond",
  "Gill Sans",
  "Palatino",
  "Segoe UI",
]);
// Fonts listed in FONT_LIBRARY but NOT loaded by the global <link> tag and
// NOT available as an uploaded custom font. Treat as missing -> use fallback.
// (Jameel Noori Nastaleeq is now served via cdnfonts in __root.tsx.)
const NON_WEB_SAFE_LIBRARY_FONTS = new Set(["Alvi Nastaleeq"]);

type PsdFontRef = { name?: unknown; family?: unknown };
type PsdSizedValue = { value?: unknown };
type PsdTextStyle = {
  font?: PsdFontRef;
  fontSize?: unknown | PsdSizedValue;
  size?: unknown | PsdSizedValue;
  fontStyle?: unknown;
  horizontalScale?: unknown;
  verticalScale?: unknown;
  fillColor?: {
    r?: number;
    g?: number;
    b?: number;
    c?: number;
    m?: number;
    y?: number;
    k?: number;
  };
};
type PsdParagraphStyle = { justification?: unknown; align?: unknown };
type PsdTextInfo = {
  text?: string;
  font?: PsdFontRef;
  transform?: unknown;
  style?: PsdTextStyle;
  styleRuns?: Array<{ style?: PsdTextStyle }>;
  paragraphStyle?: PsdParagraphStyle;
  paragraphStyleRuns?: Array<{ style?: PsdParagraphStyle }>;
};
type PsdNode = {
  name?: string;
  hidden?: boolean;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  children?: PsdNode[];
  text?: PsdTextInfo;
  canvas?: HTMLCanvasElement;
};

const FONT_ALIASES: Record<string, string> = {
  ArialMT: "Arial",
  ArialBoldMT: "Arial",
  ArialItalicMT: "Arial",
  ArialBoldItalicMT: "Arial",
  HelveticaNeueLTStdRoman: "Helvetica",
  HelveticaNeueLTStdBd: "Helvetica",
  HelveticaNeue: "Helvetica",
  CalibriRegular: "Calibri",
  CalibriBold: "Calibri",
  TimesNewRomanPSMT: "Times New Roman",
  TimesNewRomanPSBoldMT: "Times New Roman",
  TimesNewRomanPSItalicMT: "Times New Roman",
  TimesNewRomanPSBoldItalicMT: "Times New Roman",
  CourierNewPSMT: "Courier New",
  MyriadProRegular: "Myriad Pro",
  MyriadProBold: "Myriad Pro",
  NotoNastaliqUrdu: "Noto Nastaliq Urdu",
  NotoNaskhArabic: "Noto Naskh Arabic",
  MyriadArabic: "Noto Sans Arabic",
  MyriadArabicRegular: "Noto Sans Arabic",
  AcuminConcept: "Roboto Condensed",
  AcuminConceptRegular: "Roboto Condensed",
  BahnschriftSemiBold: "Roboto Condensed",
  Bahnschrift: "Roboto Condensed",
  JameelNooriNastaleeq: "Jameel Noori Nastaleeq",
  AlviNastaleeq: "Alvi Nastaleeq",
};

function normalizePsdFont(raw: unknown) {
  const value = String(raw || "Arial").trim() || "Arial";
  const compact = value.replace(/[\s_-]/g, "");
  if (FONT_ALIASES[value]) return FONT_ALIASES[value];
  if (FONT_ALIASES[compact]) return FONT_ALIASES[compact];
  return (
    value
      .replace(/PSMT$/i, "")
      .replace(/[-_](Regular|Bold|Italic|Medium|Light|Black)$/i, "")
      .trim() || value
  );
}

function isKnownDesignerFont(fontFamily: string) {
  if (isCustomFontAvailable(fontFamily)) return true;
  return (
    SYSTEM_FONTS.has(fontFamily) ||
    FONT_LIBRARY.some(
      (font) => font.family === fontFamily && !NON_WEB_SAFE_LIBRARY_FONTS.has(font.family),
    )
  );
}

function fallbackFontFor(fontFamily: string) {
  const compact = fontFamily.toLowerCase().replace(/[\s_-]/g, "");
  if (/nastaliq|nastaleeq|urdu|noori|alvi|jameel|faiz/.test(compact)) return "Noto Nastaliq Urdu";
  if (/arabic|naskh|kufi|ruqaa|amiri|scheherazade|tajawal|cairo/.test(compact)) {
    return "Noto Naskh Arabic";
  }
  if (/mono|courier|code|console/.test(compact)) return "Courier New";
  if (/serif|times|garamond|georgia|baskerville|cambria/.test(compact)) {
    return "Times New Roman";
  }
  if (/condensed|narrow/.test(compact)) return "Roboto Condensed";
  return "Arial";
}

function resolvePsdFont(raw: unknown) {
  const directCustomFamily = resolveCustomFontFamily(String(raw || ""));
  if (directCustomFamily) {
    return { family: directCustomFamily, requested: String(raw || directCustomFamily), missing: false };
  }
  const requested = normalizePsdFont(raw);
  const customFamily = resolveCustomFontFamily(requested);
  if (customFamily) return { family: customFamily, requested, missing: false };
  if (isKnownDesignerFont(requested)) return { family: requested, requested, missing: false };
  return { family: fallbackFontFor(requested), requested, missing: true };
}

function sizedValue(input: unknown) {
  if (input && typeof input === "object" && "value" in input) {
    return (input as PsdSizedValue).value;
  }
  return input;
}

function getPsdFontSize(style: PsdTextStyle, boundsHeight: number) {
  const raw = Number(sizedValue(style.fontSize) ?? sizedValue(style.size));
  if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.min(500, raw));
  return Math.max(8, Math.min(200, boundsHeight * 0.72));
}

function getPsdTextScale(style: PsdTextStyle) {
  const raw = Number(sizedValue(style.horizontalScale));
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(0.2, Math.min(3, raw > 10 ? raw / 100 : raw));
}

function getTextTransformScale(textInfo: PsdTextInfo) {
  const t = Array.isArray(textInfo.transform) ? textInfo.transform.map(Number) : null;
  if (!t || t.length < 4) return { sx: 1, sy: 1 };
  const sx = Math.hypot(t[0] || 1, t[1] || 0);
  const sy = Math.hypot(t[2] || 0, t[3] || 1);
  return {
    sx: Number.isFinite(sx) && sx > 0 ? sx : 1,
    sy: Number.isFinite(sy) && sy > 0 ? sy : 1,
  };
}

function getPsdRotation(textInfo: PsdTextInfo) {
  const t = Array.isArray(textInfo.transform) ? textInfo.transform : null;
  if (!t) return 0;
  const a = Number(t[0]) || 1;
  const b = Number(t[1]) || 0;
  const deg = Math.atan2(b, a) * (180 / Math.PI);
  return Number.isFinite(deg) ? deg : 0;
}

function getPsdFontStyle(style: PsdTextStyle, layerName: string) {
  const family = `${style.font?.name || style.font?.family || ""} ${style.fontStyle || ""} ${
    layerName || ""
  }`.toLowerCase();
  const bold = /bold|black|heavy|semibold|demi/.test(family);
  const italic = /italic|oblique/.test(family);
  return [bold ? "bold" : "", italic ? "italic" : ""].filter(Boolean).join(" ") || "normal";
}

function getPsdFillColor(style: PsdTextStyle) {
  const c = style.fillColor;
  if (!c) return "#111827";
  if (typeof c.r === "number" || typeof c.g === "number" || typeof c.b === "number") {
    return `rgb(${c.r ?? 0},${c.g ?? 0},${c.b ?? 0})`;
  }
  if (typeof c.c === "number" || typeof c.m === "number" || typeof c.y === "number") {
    const cyan = (c.c ?? 0) / 100;
    const magenta = (c.m ?? 0) / 100;
    const yellow = (c.y ?? 0) / 100;
    const black = (c.k ?? 0) / 100;
    const r = Math.round(255 * (1 - cyan) * (1 - black));
    const g = Math.round(255 * (1 - magenta) * (1 - black));
    const b = Math.round(255 * (1 - yellow) * (1 - black));
    return `rgb(${r},${g},${b})`;
  }
  return "#111827";
}

export function NewTemplateModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [memberStep, setMemberStep] = useState(false);
  const [customCount, setCustomCount] = useState<string>("4");
  const blankFileRef = useRef<HTMLInputElement>(null);
  const [blankPending, setBlankPending] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);

  const goMode = (mode: NewTemplateMode, members?: MemberCount) => {
    onOpenChange(false);
    setMemberStep(false);
    setBlankPending(null);
    try {
      sessionStorage.removeItem("designer.currentTemplateId");
      sessionStorage.removeItem("designer.currentTemplateName");
      sessionStorage.removeItem("designer.psdImport");
      if (members) sessionStorage.setItem("designer.memberCount", String(members));
      else sessionStorage.removeItem("designer.memberCount");
    } catch {
      /* ignore */
    }
    navigate({ to: "/designer", search: { mode } as never });
  };

  const pick = (mode: NewTemplateMode) => {
    if (mode === "psd") {
      fileRef.current?.click();
      return;
    }
    if (mode === "blank") {
      blankFileRef.current?.click();
      return;
    }
    if (mode === "member") {
      setMemberStep(true);
      return;
    }
    goMode(mode);
  };

  const handleBlankFile = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result);
      const img = new Image();
      img.onload = () => setBlankPending({ src, width: img.width, height: img.height });
      img.src = src;
    };
    r.readAsDataURL(file);
  };

  const commitBlank = (fitMode: "auto" | "custom") => {
    if (!blankPending) return;
    setStagedBlank({ ...blankPending, fitMode });
    goMode("blank");
  };
  const handlePsd = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".psd")) {
      toast.error("Please select a Photoshop .psd file. For JPG/PNG use Blank Template.");
      return;
    }
    setParsing(true);
    try {
      const { readPsd } = await import("ag-psd");
      const buf = await file.arrayBuffer().catch(() => {
        throw new Error(
          "File permission blocked. Move the PSD to Downloads/Files, then select it again.",
        );
      });
      const psd = readPsd(buf, { skipCompositeImageData: false });

      const W = psd.width;
      const H = psd.height;

      // Preserve the Photoshop composite as the page background. This keeps
      // the imported file visually identical even when fonts are missing.
      let bgSrc: string | null = null;
      if (psd.canvas) {
        try {
          const c = psd.canvas as HTMLCanvasElement;
          bgSrc = c.toDataURL("image/png");
        } catch {
          /* ignore */
        }
      }

      type Out = {
        id: string;
        name: string;
        type: "image" | "text";
        x: number;
        y: number;
        width: number;
        height: number;
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
        scaleXText?: number;
      };
      const out: Out[] = [];
      const missingFonts = new Set<string>();
      await loadCustomFontsOnce();
      await document.fonts?.ready;
      const walk = (nodes: PsdNode[] | undefined) => {
        if (!nodes) return;
        for (const n of nodes) {
          if (n.children) {
            walk(n.children);
            continue;
          }
          if (n.hidden) continue;
          const left = n.left ?? 0;
          const top = n.top ?? 0;
          const right = n.right ?? left;
          const bottom = n.bottom ?? top;
          const w = Math.max(1, right - left);
          const h = Math.max(1, bottom - top);
          // Text layer extraction: keep it available for editing, but the
          // untouched PSD composite remains the source of truth visually.
          if (n.text?.text) {
            const textInfo = n.text || {};
            const style = textInfo.styleRuns?.[0]?.style || textInfo.style || {};
            const resolvedFont = resolvePsdFont(
              style.font?.name ||
                style.font?.family ||
                n.text?.font?.name ||
                n.text?.font?.family ||
                "Arial",
            );
            if (resolvedFont.missing) missingFonts.add(resolvedFont.requested);
            const transformScale = getTextTransformScale(textInfo);
            const fontSize = getPsdFontSize(style, h) * transformScale.sy;
            const paragraph =
              textInfo.paragraphStyle || textInfo.paragraphStyleRuns?.[0]?.style || {};
            const justification = String(
              paragraph.justification || paragraph.align || "left",
            ).toLowerCase();
            const align = justification.includes("center")
              ? "center"
              : justification.includes("right")
                ? "right"
                : "left";
            out.push({
              id: crypto.randomUUID(),
              name: n.name || "Text",
              type: "text",
              x: left,
              y: top,
              width: w,
              height: h,
              text: n.text.text,
              fontSize,
              fontFamily: resolvedFont.family,
              fontStyle: getPsdFontStyle(style, n.name || ""),
              rotation: getPsdRotation(textInfo),
              align,
              rtl: resolvedFont.family.includes("Urdu") || resolvedFont.family.includes("Arabic"),
              originalFontFamily: resolvedFont.requested,
              fontMissing: resolvedFont.missing,
              autoFit: false,
              scaleXText: getPsdTextScale(style) * transformScale.sx,
              fill: getPsdFillColor(style),
            });
            continue;
          }
          if (!n.canvas) continue;
          try {
            const lc = n.canvas as HTMLCanvasElement;
            const useJpeg = lc.width * lc.height > 800_000;
            const src = useJpeg ? lc.toDataURL("image/jpeg", 0.85) : lc.toDataURL("image/png");
            out.push({
              id: crypto.randomUUID(),
              name: n.name || "Layer",
              type: "image",
              x: left,
              y: top,
              width: w,
              height: h,
              src,
            });
          } catch {
            /* ignore */
          }
        }
      };
      walk(psd.children as unknown as PsdNode[] | undefined);

      // Stage before navigation; IndexedDB fallback survives route reloads / preview refreshes.
      await setStagedPsd({ width: W, height: H, background: bgSrc, layers: out });
      try {
        sessionStorage.removeItem("designer.currentTemplateId");
        sessionStorage.removeItem("designer.currentTemplateName");
      } catch {
        /* ignore */
      }

      onOpenChange(false);
      setMemberStep(false);
      navigate({ to: "/designer", search: { mode: "psd" } as never });
      if (missingFonts.size > 0) {
        const names = Array.from(missingFonts);
        toast.warning(
          `PSD imported with fallback fonts. Missing: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` +${names.length - 6} more` : ""}. Text size/scale was preserved; only fallback font changed.`,
          { duration: 12000 },
        );
      } else {
        toast.success(`Imported ${out.length} layers from PSD`);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error(`PSD import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setParsing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setMemberStep(false);
          setBlankPending(null);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {blankPending
              ? "Fit the image to A4?"
              : memberStep
                ? "How many members?"
                : "Create new template"}
          </DialogTitle>
          <DialogDescription>
            {blankPending
              ? "Auto fits proportionally to A4 portrait. Custom keeps the image's original size."
              : memberStep
                ? "Pick how many member slots to start with — you can add/remove later."
                : "Pick a starting point for the Designer."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".psd"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handlePsd(f);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={blankFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleBlankFile(f);
            e.currentTarget.value = "";
          }}
        />

        {blankPending ? (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <img
                src={blankPending.src}
                alt="Preview"
                className="h-20 w-20 object-contain bg-white rounded border"
              />
              <div className="text-xs text-slate-600">
                <div className="font-semibold text-slate-900">Image loaded</div>
                <div>
                  {blankPending.width} × {blankPending.height} px
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => commitBlank("auto")}
                className="text-left rounded-lg border-2 border-primary p-4 hover:shadow-md transition bg-primary/5"
              >
                <div className="font-bold text-sm mb-1">Auto → fit A4</div>
                <div className="text-xs text-slate-600 leading-snug">
                  Canvas = A4 portrait (794×1123). Image scales to fit proportionally, centered.
                </div>
              </button>
              <button
                onClick={() => commitBlank("custom")}
                className="text-left rounded-lg border p-4 hover:border-slate-400 hover:shadow-sm transition"
              >
                <div className="font-bold text-sm mb-1">Custom → keep original</div>
                <div className="text-xs text-slate-600 leading-snug">
                  Canvas matches image size exactly ({blankPending.width}×{blankPending.height}).
                </div>
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBlankPending(null)}
              className="w-full"
            >
              ← Choose a different image
            </Button>
          </div>
        ) : memberStep ? (
          <div className="space-y-4 pt-1">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                Quick presets
              </div>
              <div className="grid grid-cols-6 gap-2">
                {([1, 2, 4, 6, 8, 20] as MemberCount[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => goMode("member", n)}
                    className="rounded-lg border p-3 text-center hover:border-slate-400 hover:shadow-sm transition"
                  >
                    <div className="text-2xl font-extrabold">{n}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">members</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-snug">
                Each page fits up to 10 members in a clear VIP-style table. Picking more than 10
                auto-paginates at entry time — no rows are split across pages.
              </p>
            </div>
            <div className="border-t pt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                Customize (1–20)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  className="flex-1 h-10 px-3 border rounded-md text-sm"
                />
                <button
                  onClick={() => {
                    const n = Math.max(1, Math.min(20, parseInt(customCount, 10) || 1));
                    goMode("member", n);
                  }}
                  className="h-10 px-4 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                >
                  Create
                </button>
              </div>
            </div>
            <button
              onClick={() => setMemberStep(false)}
              className="block w-full text-xs text-slate-500 underline mt-1"
            >
              ← Back
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              const isPsdLoading = parsing && o.id === "psd";
              return (
                <button
                  key={o.id}
                  disabled={parsing}
                  onClick={() => pick(o.id)}
                  className="text-left rounded-lg border p-4 hover:border-slate-400 hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className={`${o.tint} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}
                  >
                    {isPsdLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="font-bold text-sm">{o.title}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">{o.desc}</div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
