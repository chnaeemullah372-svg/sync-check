import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import type Konva from "konva";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  FileText,
  ScanText,
  Image as ImageIcon,
  Trash2,
  Download,
  Loader2,
  Move,
} from "lucide-react";
import { toast } from "sonner";
import {
  getEntry,
  saveEntryMember,
  deleteEntryMember,
  setEntryStatus,
  autosaveEntry,
  loadAutosave,
  recordExport,
} from "@/lib/api/entries.functions";
import { extractFromImage, getAiContext } from "@/lib/api/ai.functions";
import {
  useEntryAutosave,
  loadEntryAutosaveLocal,
} from "@/hooks/use-entry-autosave";
import {
  stageToJpegDataUrl,
  downloadDataUrl,
  pdfFromJpegPages,
} from "@/lib/export/render";
import type { Layer, TextLayer, ImageLayer } from "@/lib/designer/types";
import { UserShell } from "@/components/user/UserShell";

const PreviewCanvas = lazy(() =>
  import("@/components/entry/PreviewCanvas").then((m) => ({ default: m.PreviewCanvas })),
);

export const Route = createFileRoute("/_authenticated/user/entries/$entryId")({
  head: () => ({ meta: [{ title: "Edit Entry" }] }),
  component: EntryEditor,
});

type FormByMember = Record<number, Record<string, string>>;

function layerFieldKey(layer: Layer) {
  return layer.fieldKey || `layer:${layer.id}`;
}

function deriveFields(layers: Layer[] | undefined): { textKeys: string[]; imageKeys: string[] } {
  const t = new Set<string>();
  const i = new Set<string>();
  for (const l of layers ?? []) {
    const key = layerFieldKey(l);
    if (!key) continue;
    if (l.type === "text") t.add(key);
    else if (l.type === "image" && ((l as ImageLayer).subtype !== "asset" || !(l as ImageLayer).src)) i.add(key);
  }
  return { textKeys: [...t], imageKeys: [...i] };
}

function deriveMemberCount(layers: Layer[] | undefined): number {
  const slots = new Set<number>();
  for (const l of layers ?? []) {
    if (l.slotIndex && l.slotIndex > 0) slots.add(l.slotIndex);
  }
  if (slots.size === 0) return 1;
  return Math.max(...slots);
}

function EntryEditor() {
  const { entryId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const getFn = useServerFn(getEntry);
  const saveMemberFn = useServerFn(saveEntryMember);
  const delMemberFn = useServerFn(deleteEntryMember);
  const statusFn = useServerFn(setEntryStatus);
  const autosaveFn = useServerFn(autosaveEntry);
  const loadAutoFn = useServerFn(loadAutosave);
  const recordFn = useServerFn(recordExport);
  const aiFn = useServerFn(extractFromImage);
  const ctxFn = useServerFn(getAiContext);
  const { data: aiCtx } = useQuery({ queryKey: ["ai-context"], queryFn: () => ctxFn() });
  const canStandard = !!aiCtx && aiCtx.mode !== "disabled" && (aiCtx.userAccess === "standard" || aiCtx.userAccess === "both" || (aiCtx.userAccess === "advanced" && aiCtx.mode === "standard"));
  const canAdvanced = !!aiCtx && aiCtx.mode === "advanced" && (aiCtx.userAccess === "advanced" || aiCtx.userAccess === "both") && aiCtx.advancedConfigured;

  const { data, isLoading, error } = useQuery({
    queryKey: ["entry", entryId],
    queryFn: () => getFn({ data: { entryId } }),
  });

  const snapshot = data?.snapshot as
    | { background: any; canvasWidth: number; canvasHeight: number; layers: Layer[]; memberNames?: Record<number, string> }
    | null;

  const { textKeys, imageKeys } = useMemo(
    () => deriveFields(snapshot?.layers),
    [snapshot],
  );
  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const layer of snapshot?.layers ?? []) {
      const key = layerFieldKey(layer);
      if (!key) continue;
      labels[key] = layer.name || key;
    }
    return labels;
  }, [snapshot]);
  const slotCount = useMemo(() => deriveMemberCount(snapshot?.layers), [snapshot]);
  const memberCount = useMemo(() => {
    const named = Object.keys(snapshot?.memberNames ?? {})
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .reduce((a, b) => Math.max(a, b), 0);
    return Math.max(slotCount, named);
  }, [snapshot, slotCount]);

  // form state — keyed by member number
  const [form, setForm] = useState<FormByMember>({});
  const [memberIds, setMemberIds] = useState<Record<number, string>>({});
  const [activeMember, setActiveMember] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // per-entry preview adjustments: { [memberNo]: { [layerId]: overlay } }
  const [adjustments, setAdjustments] = useState<Record<number, Record<string, any>>>({});
  const [adjustMode, setAdjustMode] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // hydrate from server members + autosave (server then local)
  useEffect(() => {
    if (!data || hydrated) return;
    const initial: FormByMember = {};
    const ids: Record<number, string> = {};
    for (const m of data.members) {
      initial[m.member_no] = (m.data as any) ?? {};
      ids[m.member_no] = m.id;
    }
    (async () => {
      try {
        const server = await loadAutoFn({ data: { entryId } });
        if (server?.form_data) {
          const fd: any = server.form_data;
          const fdForm = fd.__form ?? fd;
          for (const k of Object.keys(fdForm)) {
            const n = Number(k);
            if (Number.isNaN(n)) continue;
            if (!initial[n]) initial[n] = fdForm[k] ?? {};
          }
          if (fd.__adjustments) setAdjustments(fd.__adjustments);
        }
        const local = await loadEntryAutosaveLocal(entryId);
        if (local?.formData) {
          const lf: any = local.formData;
          const lfForm = lf.__form ?? lf;
          for (const k of Object.keys(lfForm)) {
            const n = Number(k);
            if (Number.isNaN(n)) continue;
            initial[n] = { ...(initial[n] ?? {}), ...lfForm[k] };
          }
          if (lf.__adjustments) setAdjustments((a) => ({ ...a, ...lf.__adjustments }));
        }
      } catch {
        /* ignore */
      }
      setForm(initial);
      setMemberIds(ids);
      setHydrated(true);
    })();
  }, [data, entryId, hydrated, loadAutoFn]);

  // autosave (IDB + server)
  useEntryAutosave(
    hydrated ? entryId : undefined,
    { formData: { __form: form, __adjustments: adjustments } },
    (p) => {
      if (!data?.entry?.template_id) return;
      autosaveFn({
        data: {
          entryId,
          templateId: data.entry.template_id,
          formData: p.formData,
        },
      }).catch(() => {});
    },
  );

  const setAdjust = (memberNo: number, layerId: string, ov: any) => {
    setAdjustments((a) => ({
      ...a,
      [memberNo]: { ...(a[memberNo] ?? {}), [layerId]: { ...(a[memberNo]?.[layerId] ?? {}), ...ov } },
    }));
  };

  const resetAdjust = (memberNo: number) => {
    setAdjustments((a) => {
      const c = { ...a };
      delete c[memberNo];
      return c;
    });
    toast.success("Adjustments reset");
  };

  const setField = (memberNo: number, key: string, value: string) => {
    setForm((f) => ({ ...f, [memberNo]: { ...(f[memberNo] ?? {}), [key]: value } }));
  };

  // upload image to storage; returns public-ish signed URL
  const uploadImage = async (file: File, fieldKey: string, memberNo: number): Promise<string | null> => {
    if (!user) return null;
    // Allowlist: only safe raster image types. Block HTML/SVG/JS to prevent stored XSS via signed URLs.
    const ALLOWED_MIME: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const mime = (file.type || "").toLowerCase();
    const ext = ALLOWED_MIME[mime];
    if (!ext) {
      toast.error("Unsupported file type. Use JPG, PNG, WEBP, or GIF.");
      return null;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large (max 15MB).");
      return null;
    }
    const path = `${user.id}/${entryId}/m${memberNo}/${fieldKey}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("entry-uploads")
      .upload(path, file, { upsert: true, contentType: mime });
    if (upErr) {
      toast.error(upErr.message);
      return null;
    }
    const { data: signed } = await supabase.storage
      .from("entry-uploads")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
    return signed?.signedUrl ?? null;
  };

  // Build shareGroup → fieldKey[] map from snapshot (Shared Photo Mode)
  const shareGroups = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of snapshot?.layers ?? []) {
      if (l.type !== "image") continue;
      const sg = (l as ImageLayer).shareGroup;
      if (!sg || !l.fieldKey) continue;
      if (!m.has(sg)) m.set(sg, new Set());
      m.get(sg)!.add(l.fieldKey);
    }
    return m;
  }, [snapshot]);

  // Map of fieldKey → layer (for picking up per-layer instructions / faceCrop)
  const layerByField = useMemo(() => {
    const m = new Map<string, Layer>();
    for (const l of snapshot?.layers ?? []) {
      const k = layerFieldKey(l);
      if (k) m.set(k, l);
    }
    return m;
  }, [snapshot]);

  const onImagePick = async (memberNo: number, fieldKey: string, file: File) => {
    setBusy(`upload-${memberNo}-${fieldKey}`);
    try {
      const url = await uploadImage(file, fieldKey, memberNo);
      if (!url) return;
      // Find every fieldKey that shares a group with this one
      const siblings = new Set<string>([fieldKey]);
      for (const keys of shareGroups.values()) {
        if (keys.has(fieldKey)) for (const k of keys) siblings.add(k);
      }
      setForm((f) => {
        const next = { ...f, [memberNo]: { ...(f[memberNo] ?? {}) } };
        for (const k of siblings) next[memberNo][k] = url;
        return next;
      });
      // Surface the per-layer instruction so the user knows it was applied.
      const layer = layerByField.get(fieldKey) as ImageLayer | undefined;
      const inst = (layer as any)?.aiInstruction?.trim();
      if (inst) toast.success(`Applied: ${inst.slice(0, 80)}${inst.length > 80 ? "…" : ""}`);
      else if (layer?.faceCrop && layer.faceCrop !== "none") toast.success(`Applied crop: ${layer.faceCrop.replace(/_/g, " ")}`);
    } finally {
      setBusy(null);
    }
  };

  const combinedInstructions = useMemo(() => {
    const base = ((data?.entry?.templates as any)?.ai_instructions ?? "").trim();
    const perField: string[] = [];
    for (const [key, layer] of layerByField.entries()) {
      const inst = ((layer as any).aiInstruction ?? "").trim();
      if (inst) perField.push(`- ${fieldLabels[key] || key}: ${inst}`);
    }
    if (!base && perField.length === 0) return undefined;
    return [base, perField.length ? `Per-field rules:\n${perField.join("\n")}` : ""].filter(Boolean).join("\n\n");
  }, [data, layerByField, fieldLabels]);

  // Build per-field metadata (label, subtype, language, instruction, rtl) so the
  // AI fills each layer in the correct script even when source text is in another language.
  const hasUrduChars = (s: string) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
  const inferLanguage = (key: string, label: string, rtl?: boolean):
    "urdu" | "english" | "roman" | "numeric" | "mixed" | "auto" => {
    const k = key.toLowerCase();
    if (/_urdu$|^urdu_|_ur$|_ur_/.test(k)) return "urdu";
    if (/_english$|^english_|_en$|_eng$/.test(k)) return "english";
    if (/_roman$|romanized/.test(k)) return "roman";
    if (rtl || hasUrduChars(label)) return "urdu";
    if (["cnic", "phone", "dob", "doi", "doe"].includes(k) || /date|number|_no$/.test(k)) return "numeric";
    return "auto";
  };
  const fieldsMeta = useMemo(() => {
    const out: Array<{
      key: string; label?: string; subtype?: string; aiInstruction?: string;
      expectedLanguage?: "urdu" | "english" | "roman" | "numeric" | "mixed" | "auto";
      rtl?: boolean;
    }> = [];
    for (const key of textKeys) {
      const layer = layerByField.get(key) as TextLayer | undefined;
      const label = fieldLabels[key] || key;
      const rtl = !!(layer as any)?.rtl;
      out.push({
        key,
        label,
        aiInstruction: ((layer as any)?.aiInstruction ?? "").trim() || undefined,
        expectedLanguage: inferLanguage(key, label, rtl),
        rtl,
      });
    }
    return out;
  }, [textKeys, layerByField, fieldLabels]);

  // Extract from uploaded image
  const onAiFill = async (memberNo: number, file: File, mode: "standard" | "advanced" = "standard") => {
    if (textKeys.length === 0) {
      toast.error("This template has no fillable text fields");
      return;
    }
    setBusy(`ai-${memberNo}`);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const res = await aiFn({ data: { image: dataUrl, fields: textKeys, labels: fieldLabels, fieldsMeta, instructions: combinedInstructions, mode, entryId, templateId: data?.entry?.template_id ?? undefined } });
      setForm((f) => ({ ...f, [memberNo]: { ...(f[memberNo] ?? {}), ...res.values } }));
      toast.success(`Filled ${Object.keys(res.values).length} fields`);
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally {
      setBusy(null);
    }
  };

  // Extract from pasted text
  const onAiFillText = async (memberNo: number, text: string, mode: "standard" | "advanced" = "standard") => {
    if (textKeys.length === 0) {
      toast.error("This template has no fillable text fields");
      return;
    }
    if (!text.trim()) return;
    setBusy(`ai-${memberNo}`);
    try {
      const res = await aiFn({ data: { text, fields: textKeys, labels: fieldLabels, fieldsMeta, instructions: combinedInstructions, mode, entryId, templateId: data?.entry?.template_id ?? undefined } });
      setForm((f) => ({ ...f, [memberNo]: { ...(f[memberNo] ?? {}), ...res.values } }));
      toast.success(`Filled ${Object.keys(res.values).length} fields`);
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally {
      setBusy(null);
    }
  };


  const saveMember = useMutation({
    mutationFn: async (memberNo: number) => {
      const payload = form[memberNo] ?? {};
      const res = await saveMemberFn({
        data: { entryId, memberNo, data: payload },
      });
      return { memberNo, id: res.id };
    },
    onSuccess: (r) => {
      setMemberIds((m) => ({ ...m, [r.memberNo]: r.id }));
      qc.invalidateQueries({ queryKey: ["entry", entryId] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAll = async () => {
    setBusy("save-all");
    try {
      for (const n of Object.keys(form)) {
        await saveMember.mutateAsync(Number(n));
      }
      toast.success("All saved");
    } finally {
      setBusy(null);
    }
  };

  const markFinal = useMutation({
    mutationFn: () => statusFn({ data: { entryId, status: "final" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry", entryId] });
      toast.success("Marked final");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ----- export -----
  const stageRefs = useRef<Map<number, Konva.Stage | null>>(new Map());

  const waitForPreviewStage = async (memberNo: number) => {
    for (let i = 0; i < 12; i++) {
      const stage = stageRefs.current.get(memberNo);
      const mounted = !!stage?.container()?.isConnected;
      const width = Number(stage?.width());
      const height = Number(stage?.height());
      if (stage && mounted && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        console.info("[export] stage mounted", { memberNo, width, height, scaleX: stage.scaleX(), scaleY: stage.scaleY() });
        return stage;
      }
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    }
    console.warn("[export] missing stage", { memberNo, available: [...stageRefs.current.keys()] });
    return null;
  };

  const exportPdf = async () => {
    if (!snapshot) return;
    setAdjustMode(false);
    setBusy("pdf");
    try {
      const cw = Math.round(Number(snapshot.canvasWidth) || 794);
      const ch = Math.round(Number(snapshot.canvasHeight) || 1123);
      const slotsPerPageLocal = Math.max(1, Math.min(15, slotCount));
      const maxFilled = Object.keys(form)
        .map(Number)
        .filter((n) => !Number.isNaN(n) && Object.values(form[n] ?? {}).some((v) => String(v ?? "").trim() !== ""))
        .reduce((a, b) => Math.max(a, b), 0);
      const pageCountLocal = Math.max(1, Math.ceil(Math.max(memberCount, maxFilled) / slotsPerPageLocal));
      console.info("[export] pdf start", { entryId, canvasWidth: cw, canvasHeight: ch, pages: pageCountLocal });
      const pages: { dataUrl: string; widthPx: number; heightPx: number }[] = [];
      for (let p = 1; p <= pageCountLocal; p++) {
        const stage = await waitForPreviewStage(p);
        if (!stage) continue;
        const url = await stageToJpegDataUrl(stage, 2, 0.9);
        pages.push({ dataUrl: url, widthPx: cw, heightPx: ch });
      }
      if (pages.length === 0) {
        toast.error("Preview not ready");
        return;
      }
      await pdfFromJpegPages(pages, `entry-${data?.entry?.entry_no ?? "x"}.pdf`);
      await recordFn({ data: { entryId, exportType: "pdf" } });
      toast.success("PDF exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const exportJpg = async () => {
    if (!snapshot) return;
    setAdjustMode(false);
    setBusy("jpg");
    try {
      const slotsPerPageLocal = Math.max(1, Math.min(15, slotCount));
      const maxFilled = Object.keys(form)
        .map(Number)
        .filter((n) => !Number.isNaN(n) && Object.values(form[n] ?? {}).some((v) => String(v ?? "").trim() !== ""))
        .reduce((a, b) => Math.max(a, b), 0);
      const pageCountLocal = Math.max(1, Math.ceil(Math.max(memberCount, maxFilled) / slotsPerPageLocal));
      let count = 0;
      for (let p = 1; p <= pageCountLocal; p++) {
        const stage = await waitForPreviewStage(p);
        if (!stage) continue;
        const url = await stageToJpegDataUrl(stage, 2, 0.92);
        downloadDataUrl(url, `entry-${data?.entry?.entry_no ?? "x"}-p${p}.jpg`);
        count++;
      }
      if (count === 0) {
        toast.error("Preview not ready");
        return;
      }
      await recordFn({ data: { entryId, exportType: "jpg" } });
      toast.success(`Exported ${count} image${count === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  };


  const removeMember = async (n: number) => {
    if (!confirm(`Remove member #${n}?`)) return;
    try {
      await delMemberFn({ data: { entryId, memberNo: n } });
      setForm((f) => {
        const c = { ...f };
        delete c[n];
        return c;
      });
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-rose-600">Could not load entry.</p>
        <Link to="/user">
          <Button variant="outline">Back</Button>
        </Link>
      </div>
    );
  }

  const tpl: any = data.entry?.templates;
  const slotsPerPage = Math.max(1, Math.min(15, slotCount));
  const maxFilledMember = Object.keys(form)
    .map(Number)
    .filter((n) => !Number.isNaN(n) && Object.values(form[n] ?? {}).some((v) => String(v ?? "").trim() !== ""))
    .reduce((a, b) => Math.max(a, b), 0);
  const totalMembers = Math.max(memberCount, maxFilledMember);
  const pageCount = Math.max(1, Math.ceil(totalMembers / slotsPerPage));
  const memberList = Array.from({ length: totalMembers }, (_, i) => i + 1);


  return (
    <UserShell title={`${tpl?.name ?? "Template"} · Entry #${data.entry.entry_no}`}>
      <div className="space-y-5 pb-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate({ to: "/user/templates/$tid", params: { tid: data.entry.template_id } })}
              className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-user-muted hover:text-user-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to template
            </button>
            <p className="text-xs font-black uppercase tracking-widest text-user-brand">
              Entry #{data.entry.entry_no} · {data.entry.status}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-user-ink">
              {tpl?.name ?? "Template"}
            </h1>
            <p className="mt-1 text-sm text-user-muted">Fill only the boxes generated from the admin template layers.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              className="h-10"
              onClick={() => setBulkOpen(true)}
              disabled={textKeys.length === 0}
              title="Paste multi-member data; AI splits and fills every member"
            >
              <ScanText className="h-4 w-4 mr-1" /> Smart Fill All Members
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => navigate({ to: "/designer", search: { tid: data.entry.template_id, editor: "user", entryId } as never })}
            >
              <Move className="h-4 w-4 mr-1" /> Customize Template
            </Button>
          </div>
        </div>

        {bulkOpen && (
          <Card className="p-4 border-user-brand/40 bg-user-brand/5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-user-ink">Smart Fill All {memberCount} Members</p>
                <p className="text-xs text-user-muted">Paste data for all members (any language). AI will split it across members.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setBulkOpen(false)}>Close</Button>
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              placeholder={"e.g.\n52201-2307390-7\nHammad Raza Baloch · Self\nLal Muhammad · Father · No id card\n..."}
              className="text-sm font-mono"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                onClick={async () => {
                  if (!bulkText.trim()) return;
                  if (textKeys.length === 0) { toast.error("No fillable fields"); return; }
                  setBusy("bulk");
                  try {
                    const res = await aiFn({ data: { text: bulkText, fields: textKeys, labels: fieldLabels, fieldsMeta, instructions: combinedInstructions, mode: canAdvanced ? "advanced" : "standard", entryId, templateId: data?.entry?.template_id ?? undefined, memberCount: 20 } });
                    const arr = (res as any).members as Array<Record<string, string>> | null;
                    if (arr && arr.length > 0) {
                      setForm((f) => {
                        const next = { ...f };
                        arr.forEach((vals, i) => {
                          const n = i + 1;
                          next[n] = { ...(next[n] ?? {}), ...vals };
                        });
                        return next;
                      });
                      toast.success(`Filled ${arr.length} member${arr.length > 1 ? "s" : ""}`);
                      setBulkOpen(false);
                    } else if (res.values && Object.keys(res.values).length > 0) {
                      setForm((f) => ({ ...f, [activeMember]: { ...(f[activeMember] ?? {}), ...res.values } }));
                      toast.success("Filled active member only");
                    } else {
                      toast.error("AI returned no data");
                    }
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed");
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy === "bulk"}
              >
                {busy === "bulk" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ScanText className="h-4 w-4 mr-1" />}
                Fill {memberCount} Members
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
          <FormSection
            memberList={memberList}
            activeMember={activeMember}
            setActiveMember={setActiveMember}
            snapshot={snapshot}
            textKeys={textKeys}
            imageKeys={imageKeys}
            fieldLabels={fieldLabels}
            form={form}
            setField={setField}
            onAiFill={onAiFill}
            onAiFillText={onAiFillText}
            canStandard={canStandard}
            canAdvanced={canAdvanced}
            onImagePick={onImagePick}
            onRemoveMember={removeMember}
            busy={busy}
            saveMember={(n) => saveMember.mutate(n)}
          />
          <PreviewSection
            snapshot={snapshot}
            memberList={memberList}
            slotsPerPage={slotsPerPage}
            pageCount={pageCount}
            form={form}
            imageKeys={imageKeys}
            stageRefs={stageRefs}
            adjustments={adjustments}
            adjustMode={adjustMode}
            onToggleAdjust={() => setAdjustMode((v) => !v)}
            onAdjust={setAdjust}
            onResetAdjust={resetAdjust}
          />

        </div>

        <div className="fixed inset-x-0 bottom-3 z-40 px-3 lg:left-64">
          <Card className="mx-auto flex max-w-7xl items-center gap-2 border-user-border bg-user-surface p-2 shadow-2xl">
            <Button onClick={saveAll} disabled={busy === "save-all"} variant="outline" size="sm" className="border-user-border bg-user-surface">
              {busy === "save-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button
              onClick={() => markFinal.mutate()}
              disabled={markFinal.isPending}
              variant="outline"
              size="sm"
              className="border-user-border bg-user-surface"
            >
              <CheckCircle2 className="h-4 w-4" /> Final
            </Button>
            <div className="ml-auto flex gap-2">
              <Button onClick={exportJpg} disabled={busy === "jpg"} size="sm" className="bg-user-sidebar text-user-sidebar-foreground hover:bg-user-sidebar-hover">
                {busy === "jpg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                JPG
              </Button>
              <Button onClick={exportPdf} disabled={busy === "pdf"} size="sm" className="bg-user-brand text-user-sidebar-foreground hover:bg-user-brand/90">
                {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </UserShell>
  );
}

/* ============ Form Section ============ */
function FormSection(props: {
  memberList: number[];
  activeMember: number;
  setActiveMember: (n: number) => void;
  snapshot: any;
  textKeys: string[];
  imageKeys: string[];
  fieldLabels: Record<string, string>;
  form: FormByMember;
  setField: (n: number, k: string, v: string) => void;
  onAiFill: (n: number, file: File, mode?: "standard" | "advanced") => void;
  onAiFillText: (n: number, text: string, mode?: "standard" | "advanced") => void;
  canStandard: boolean;
  canAdvanced: boolean;
  onImagePick: (n: number, k: string, file: File) => void;
  onRemoveMember: (n: number) => void;
  busy: string | null;
  saveMember: (n: number) => void;
}) {
  const {
    memberList,
    activeMember,
    setActiveMember,
    snapshot,
    textKeys,
    imageKeys,
    fieldLabels,
    form,
    setField,
    onAiFill,
    onAiFillText,
    canStandard,
    canAdvanced,
    onImagePick,
    onRemoveMember,
    busy,
    saveMember,
  } = props;

  if (!snapshot) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500 border-dashed">
        This template has no design yet. Ask your admin to publish it.
      </Card>
    );
  }
  if (textKeys.length === 0 && imageKeys.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500 border-dashed">
        This template has no fillable fields.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {memberList.length > 1 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-user-border bg-user-surface p-2">
          {memberList.map((n) => (
            <button
              key={n}
              onClick={() => setActiveMember(n)}
              className={`rounded-md border px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                activeMember === n
                  ? "border-user-sidebar-active bg-user-sidebar-active text-user-sidebar-foreground"
                  : "border-user-border bg-user-surface text-user-muted hover:border-user-brand hover:text-user-ink"
              }`}
            >
              {snapshot.memberNames?.[n] ?? `Member ${n}`}
            </button>
          ))}
        </div>
      )}

      {memberList.map((n) =>
        n === activeMember ? (
          <MemberForm
            key={n}
            memberNo={n}
            label={snapshot.memberNames?.[n] ?? `Member ${n}`}
            textKeys={textKeys}
            imageKeys={imageKeys}
            fieldLabels={fieldLabels}
            values={form[n] ?? {}}
            setField={(k, v) => setField(n, k, v)}
            onAiFill={(file, mode) => onAiFill(n, file, mode)}
            onAiFillText={(text, mode) => onAiFillText(n, text, mode)}
            canStandard={canStandard}
            canAdvanced={canAdvanced}
            onImagePick={(k, file) => onImagePick(n, k, file)}
            onRemove={memberList.length > 1 ? () => onRemoveMember(n) : undefined}
            busy={busy}
            onSave={() => saveMember(n)}
          />
        ) : null,
      )}
    </div>
  );
}

function MemberForm(props: {
  memberNo: number;
  label: string;
  textKeys: string[];
  imageKeys: string[];
  fieldLabels: Record<string, string>;
  values: Record<string, string>;
  setField: (k: string, v: string) => void;
  onAiFill: (file: File, mode?: "standard" | "advanced") => void;
  onAiFillText: (text: string, mode?: "standard" | "advanced") => void;
  canStandard: boolean;
  canAdvanced: boolean;
  onImagePick: (k: string, file: File) => void;
  onRemove?: () => void;
  busy: string | null;
  onSave: () => void;
}) {
  const { label, textKeys, imageKeys, fieldLabels, values, setField, onAiFill, onAiFillText, canStandard, canAdvanced, onImagePick, onRemove, busy, onSave, memberNo } = props;
  const stdRef = useRef<HTMLInputElement>(null);
  const advRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="space-y-4 border-user-border bg-user-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-user-border pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-user-brand">Data Entry</p>
          <h3 className="text-xl font-black tracking-normal text-user-ink">{label}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onSave} className="border-user-border bg-user-surface">
            <Save className="h-4 w-4" /> Save
          </Button>
          {onRemove && (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Document Extraction */}
      {textKeys.length > 0 && (canStandard || canAdvanced) && (
        <Card className="space-y-3 border-user-border bg-user-brand-soft p-3 shadow-none">
          <div className="flex flex-wrap items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-user-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-user-ink">Document Extraction</p>
              <p className="text-[11px] text-user-muted">
                Paste text or upload a document — fields fill automatically.
              </p>
            </div>
            <input
              ref={stdRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onAiFill(f, "standard"); e.target.value = ""; }}
            />
            <input
              ref={advRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onAiFill(f, "advanced"); e.target.value = ""; }}
            />
            {canStandard && (
              <Button size="sm" variant="outline" onClick={() => stdRef.current?.click()} disabled={busy === `ai-${memberNo}`} className="border-user-border bg-user-surface">
                {busy === `ai-${memberNo}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Extract &amp; Fill
              </Button>
            )}
            {canAdvanced && (
              <Button size="sm" onClick={() => advRef.current?.click()} disabled={busy === `ai-${memberNo}`} className="bg-user-brand text-user-sidebar-foreground hover:bg-user-brand/90">
                {busy === `ai-${memberNo}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
                Smart Extract &amp; Fill
              </Button>
            )}
          </div>
          <PasteTextFill
            onFill={onAiFillText}
            disabled={busy === `ai-${memberNo}`}
            canStandard={canStandard}
            canAdvanced={canAdvanced}
          />
        </Card>
      )}


      {/* Text fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {textKeys.map((k) => {
          const label = fieldLabels[k] || prettyLabel(k);
          const isLong = k.includes("address") || label.toLowerCase().includes("address");
          return (
            <div key={k} className={`rounded-md border border-user-border bg-user-page p-3 ${isLong ? "sm:col-span-2" : ""}`}>
              <Label className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-user-muted">
                {label}
              </Label>
              {isLong ? (
                <Textarea
                  rows={2}
                  value={values[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                  className="border-user-border bg-user-surface text-user-ink placeholder:text-transparent"
                />
              ) : (
                <Input
                  value={values[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                  aria-label={label}
                  className="border-user-border bg-user-surface text-user-ink placeholder:text-transparent"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Image fields */}
      {imageKeys.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imageKeys.map((k) => (
            <ImageField
              key={k}
              label={fieldLabels[k] || prettyLabel(k)}
              value={values[k]}
              onPick={(file) => onImagePick(k, file)}
              busy={busy === `upload-${memberNo}-${k}`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ImageField({
  label,
  value,
  onPick,
  busy,
}: {
  label: string;
  value?: string;
  onPick: (file: File) => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-user-border bg-user-page text-xs font-bold text-user-muted hover:border-user-brand hover:text-user-ink"
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <ImageIcon className="h-5 w-5 mb-1" />
          <span className="px-2 text-center">{label}</span>
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

/* ============ Preview Section ============ */
function PreviewSection(props: {
  snapshot: any;
  memberList: number[];
  slotsPerPage: number;
  pageCount: number;
  form: FormByMember;
  imageKeys: string[];
  stageRefs: React.MutableRefObject<Map<number, Konva.Stage | null>>;
  adjustments: Record<number, Record<string, any>>;
  adjustMode: boolean;
  onToggleAdjust: () => void;
  onAdjust: (memberNo: number, layerId: string, ov: any) => void;
  onResetAdjust: (memberNo: number) => void;
}) {
  const { snapshot, slotsPerPage, pageCount, form, imageKeys, stageRefs, adjustments, adjustMode, onAdjust } = props;
  if (!snapshot) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500 border-dashed">
        Preview unavailable.
      </Card>
    );
  }
  const pages = Array.from({ length: pageCount }, (_, i) => i);
  return (
    <Card className="space-y-3 border-user-border bg-user-surface p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-user-brand">Preview</p>
          <h3 className="text-lg font-black tracking-normal text-user-ink">
            Template Output · {pageCount} page{pageCount > 1 ? "s" : ""} · {slotsPerPage} per page
          </h3>
        </div>
      </div>

      {pages.map((p) => {
        // Build per-slot values for this page (slot s → memberNo p*slotsPerPage + s)
        const valuesBySlot: Record<number, Record<string, string>> = {};
        const imagesBySlot: Record<number, Record<string, string>> = {};
        const mergedAdj: Record<string, any> = {};
        for (let s = 1; s <= slotsPerPage; s++) {
          const memberNo = p * slotsPerPage + s;
          const v = form[memberNo] ?? {};
          valuesBySlot[s] = v;
          const ims: Record<string, string> = {};
          for (const k of imageKeys) if (v[k]) ims[k] = v[k];
          imagesBySlot[s] = ims;
          const adj = adjustments[memberNo] ?? {};
          for (const [lid, ov] of Object.entries(adj)) mergedAdj[lid] = ov;
        }
        const pageNo = p + 1;
        return (
          <div key={p} className="w-full">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-user-muted">
                Page {pageNo} of {pageCount}
              </p>
            </div>

            <Suspense
              fallback={
                <div className="text-xs text-slate-400 py-12">Rendering…</div>
              }
            >
              <PreviewCanvas
                snapshot={snapshot}
                memberNo={1}
                values={valuesBySlot[1] ?? {}}
                images={imagesBySlot[1] ?? {}}
                valuesBySlot={valuesBySlot}
                imagesBySlot={imagesBySlot}
                adjustments={mergedAdj}
                editable={adjustMode}
                onAdjust={(layerId, ov) => onAdjust(p * slotsPerPage + 1, layerId, ov)}
                stageRef={{
                  get current() {
                    return stageRefs.current.get(pageNo) ?? null;
                  },
                  set current(v) {
                    stageRefs.current.set(pageNo, v);
                  },
                } as any}
                maxWidth={900}
              />
            </Suspense>
          </div>
        );
      })}
    </Card>
  );
}



function PasteTextFill({ onFill, disabled, canStandard, canAdvanced }: { onFill: (text: string, mode?: "standard" | "advanced") => void; disabled: boolean; canStandard: boolean; canAdvanced: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Textarea
        rows={2}
        placeholder="Paste details (Urdu, English, mixed)…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="text-xs flex-1"
        dir="auto"
      />
      <div className="flex shrink-0 gap-2">
        {canStandard && (
          <Button size="sm" disabled={disabled || !text.trim()} onClick={() => { onFill(text, "standard"); setText(""); }} variant="outline">
            <FileText className="h-4 w-4" /> Extract
          </Button>
        )}
        {canAdvanced && (
          <Button size="sm" disabled={disabled || !text.trim()} onClick={() => { onFill(text, "advanced"); setText(""); }}>
            <ScanText className="h-4 w-4" /> Smart Extract
          </Button>
        )}
      </div>
    </div>
  );
}


function prettyLabel(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Cnic/, "CNIC")
    .replace(/Dob/, "DOB")
    .replace(/Doi/, "DOI");
}
