import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setStagedPsd } from "@/lib/designer/psd-staging";
import { setStagedBlank } from "@/lib/designer/blank-staging";
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

export function NewTemplateModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [memberStep, setMemberStep] = useState(false);
  const [customCount, setCustomCount] = useState<string>("4");
  const blankFileRef = useRef<HTMLInputElement>(null);
  const [blankPending, setBlankPending] = useState<{ src: string; width: number; height: number } | null>(null);

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
        throw new Error("File permission blocked. Move the PSD to Downloads/Files, then select it again.");
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

      type Out = { id: string; name: string; type: "image" | "text"; x: number; y: number; width: number; height: number; src?: string; text?: string; fontSize?: number; fontFamily?: string; fill?: string };
      const out: Out[] = [];
      const walk = (nodes: any[] | undefined) => {
        if (!nodes) return;
        for (const n of nodes) {
          if (n.children) { walk(n.children); continue; }
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
            const style = n.text.style || {};
            const fontFamily = style.font?.name || style.font?.family || "Arial";
            const fontSize = Number(style.fontSize?.value ?? style.fontSize ?? 24) || 24;
            out.push({
              id: crypto.randomUUID(),
              name: n.name || "Text",
              type: "text",
              x: left, y: top, width: w, height: h,
              text: n.text.text,
              fontSize,
              fontFamily,
              fill: style.fillColor ? `rgb(${style.fillColor.r ?? 0},${style.fillColor.g ?? 0},${style.fillColor.b ?? 0})` : "#111827",
            });
            continue;
          }
          if (!n.canvas) continue;
          try {
            const lc = n.canvas as HTMLCanvasElement;
            const useJpeg = (lc.width * lc.height) > 800_000;
            const src = useJpeg ? lc.toDataURL("image/jpeg", 0.85) : lc.toDataURL("image/png");
            out.push({
              id: crypto.randomUUID(),
              name: n.name || "Layer",
              type: "image",
              x: left, y: top, width: w, height: h, src,
            });
          } catch {
            /* ignore */
          }
        }
      };
      walk(psd.children);

      // Stage in memory — zero storage limits, survives the navigation
      setStagedPsd({ width: W, height: H, background: bgSrc, layers: out });
      try {
        sessionStorage.removeItem("designer.currentTemplateId");
        sessionStorage.removeItem("designer.currentTemplateName");
      } catch { /* ignore */ }

      onOpenChange(false);
      setMemberStep(false);
      navigate({ to: "/designer", search: { mode: "psd" } as never });
      toast.success(`Imported ${out.length} layers from PSD`);
    } catch (e: any) {
      console.error(e);
      toast.error(`PSD import failed: ${e?.message || e}`);
    } finally {
      setParsing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setMemberStep(false); setBlankPending(null); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {blankPending ? "Fit the image to A4?" : memberStep ? "How many members?" : "Create new template"}
          </DialogTitle>
          <DialogDescription>
            {blankPending
              ? "Auto fits proportionally to A4 portrait. Custom keeps the image's original size."
              : memberStep ? "Pick how many member slots to start with — you can add/remove later." : "Pick a starting point for the Designer."}
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
              <img src={blankPending.src} alt="Preview" className="h-20 w-20 object-contain bg-white rounded border" />
              <div className="text-xs text-slate-600">
                <div className="font-semibold text-slate-900">Image loaded</div>
                <div>{blankPending.width} × {blankPending.height} px</div>
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
            <Button variant="ghost" size="sm" onClick={() => setBlankPending(null)} className="w-full">← Choose a different image</Button>
          </div>
        ) : memberStep ? (
          <div className="space-y-4 pt-1">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Quick presets</div>
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
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Customize (1–20)</div>
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
                  <div className={`${o.tint} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                    {isPsdLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
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
