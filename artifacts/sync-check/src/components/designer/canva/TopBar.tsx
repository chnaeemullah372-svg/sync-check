import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Undo2, Redo2, MoreHorizontal, Check, Download, Maximize2, Sparkles, Loader2 } from "lucide-react";
import { useDesigner } from "@/lib/designer/store";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveTemplate } from "@/lib/api/templates.functions";
import { analyzeLayerNames } from "@/lib/api/ai.functions";
import { useQueryClient } from "@tanstack/react-query";
import { clearDesignerAutosave } from "@/hooks/use-designer-autosave";
import { withMemberTemplateMeta } from "@/lib/designer/member-template";
import { FIELD_KEYS } from "@/lib/designer/types";
import type { FieldKey } from "@/lib/designer/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Props {
  userMode?: boolean;
  entryId?: string;
}

type AiSuggestion = { id: string; fieldKey: string; label: string; layerName: string; layerType: string; accepted: boolean };

const FIELD_KEY_COLORS: Record<string, string> = {
  name: "bg-blue-100 text-blue-700",
  father_name: "bg-indigo-100 text-indigo-700",
  mother_name: "bg-purple-100 text-purple-700",
  cnic: "bg-orange-100 text-orange-700",
  dob: "bg-amber-100 text-amber-700",
  doi: "bg-yellow-100 text-yellow-700",
  address: "bg-green-100 text-green-700",
  relation: "bg-teal-100 text-teal-700",
  phone: "bg-cyan-100 text-cyan-700",
  photo: "bg-rose-100 text-rose-700",
  thumb: "bg-pink-100 text-pink-700",
  signature: "bg-fuchsia-100 text-fuchsia-700",
  custom_1: "bg-slate-100 text-slate-700",
  custom_2: "bg-slate-100 text-slate-700",
  custom_3: "bg-slate-100 text-slate-700",
  "": "bg-gray-100 text-gray-500",
};

export function CanvaTopBar({ userMode, entryId }: Props) {
  const { undo, redo, history, future, userZoom, zoomReset, updateLayer, layers } = useDesigner();
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const saveTemplateFn = useServerFn(saveTemplate);
  const analyzeLayerNamesFn = useServerFn(analyzeLayerNames);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const backTo = userMode && entryId ? `/user/entries/${entryId}` : "/card/admin";

  const onSave = async () => {
    if (userMode) {
      if (!entryId) { toast.error("Missing entry id"); return; }
      const s = useDesigner.getState();
      try {
        localStorage.setItem(`designer.userEdit.${entryId}`, JSON.stringify({
          background: s.background, canvasWidth: s.canvasWidth, canvasHeight: s.canvasHeight,
          layers: s.layers, memberNames: s.memberNames, savedAt: Date.now(),
        }));
        toast.success("Saved on this device");
      } catch (e: any) { toast.error(e?.message || "Save failed"); }
      return;
    }
    const currentTid = sessionStorage.getItem("designer.currentTemplateId");
    const currentName = sessionStorage.getItem("designer.currentTemplateName");
    const defaultName = currentName || `Template ${new Date().toLocaleString()}`;
    const name = prompt(currentTid ? "Update template name?" : "New template name?", defaultName);
    if (name === null) return;
    const finalName = name.trim() || defaultName;
    const state = useDesigner.getState();
    const snapshot = withMemberTemplateMeta({
      layers: state.layers,
      memberNames: state.memberNames,
      background: state.background,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
    }, finalName);
    try {
      setSaving(true);
      const res = await saveTemplateFn({
        data: {
          templateId: currentTid ?? undefined,
          name: finalName,
          pageSize: state.sizePreset,
          width: state.canvasWidth,
          height: state.canvasHeight,
          backgroundUrl: state.background?.src ?? null,
          snapshot,
          membersPerPage: snapshot.membersPerPage,
          aiInstructions: localStorage.getItem("designer.aiInstructions") || null,
        },
      });
      if (res?.id) {
        sessionStorage.setItem("designer.currentTemplateId", res.id);
        sessionStorage.setItem("designer.currentTemplateName", finalName);
      }
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      qc.invalidateQueries({ queryKey: ["my-templates"] });
      clearDesignerAutosave();
      toast.success(currentTid ? `Updated: ${finalName}` : `Saved: ${finalName}`);
      navigate({ to: "/card/admin" });
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  const onAnalyzeLayers = async () => {
    const currentLayers = useDesigner.getState().layers;
    const analyzable = currentLayers
      .filter((l) => l.type === "text" || l.type === "image")
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type as "text" | "image" | "box" | "line",
        currentFieldKey: l.fieldKey || undefined,
      }));
    if (analyzable.length === 0) {
      toast.error("No text or image layers to analyse.");
      return;
    }
    setAiLoading(true);
    setAiOpen(true);
    setSuggestions([]);
    try {
      const res = await analyzeLayerNamesFn({ data: { layers: analyzable } });
      const built: AiSuggestion[] = res.results.map((r) => {
        const orig = analyzable.find((l) => l.id === r.id);
        return {
          id: r.id,
          fieldKey: r.fieldKey,
          label: r.label,
          layerName: orig?.name ?? r.id,
          layerType: orig?.type ?? "text",
          accepted: r.fieldKey !== "",
        };
      });
      setSuggestions(built);
    } catch (e: any) {
      toast.error(e?.message || "AI analysis failed");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const applyMappings = () => {
    const toApply = suggestions.filter((s) => s.accepted);
    toApply.forEach((s) => {
      updateLayer(s.id, { fieldKey: s.fieldKey as FieldKey, name: s.label || undefined } as any);
    });
    toast.success(`Applied ${toApply.length} field mapping${toApply.length !== 1 ? "s" : ""}.`);
    setAiOpen(false);
  };

  return (
    <>
      <header className="h-12 shrink-0 border-b bg-card px-1 flex items-center gap-0.5">
        <Link to={backTo as any} className="shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>

        <Button
          variant="ghost" size="icon" className="h-9 w-9"
          onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-9 w-9"
          onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-5 w-5" />
        </Button>

        <button
          onClick={zoomReset}
          className="px-2 h-7 ml-1 border rounded-md text-[11px] hover:bg-accent tabular-nums"
          title="Reset zoom"
        >
          {Math.round(userZoom * 100)}%
        </button>

        <div className="ml-auto flex items-center gap-1">
          {!userMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 gap-1 text-xs"
              onClick={onAnalyzeLayers}
              disabled={aiLoading}
              title="Let AI analyse layer names and suggest field key mappings"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              AI Map Layers
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" title="More">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Template</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => zoomReset()}>
                <Maximize2 className="h-4 w-4 mr-2" /> Fit to screen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Download className="h-4 w-4 mr-2" /> Export (coming soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            className="h-9 px-3 rounded-full"
            onClick={onSave}
            disabled={saving}
            title="Save"
          >
            <Check className="h-4 w-4 mr-1" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {/* AI Layer Analysis Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI Layer Mapping
            </DialogTitle>
            <DialogDescription>
              AI has analysed your layer names and suggested field key assignments for auto-fill.
              Tick the rows you want to apply, then click Apply.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Analysing {layers.filter((l) => l.type === "text" || l.type === "image").length} layers…</span>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No suggestions returned.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr className="text-left text-muted-foreground text-xs">
                    <th className="py-2 px-2 w-8">✓</th>
                    <th className="py-2 px-2">Layer Name</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2">Suggested Label</th>
                    <th className="py-2 px-2">Field Key</th>
                    <th className="py-2 px-2">Change To</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr key={s.id} className={`border-b last:border-0 ${s.accepted ? "" : "opacity-50"}`}>
                      <td className="py-1.5 px-2">
                        <input
                          type="checkbox"
                          checked={s.accepted}
                          disabled={s.fieldKey === ""}
                          onChange={(e) => setSuggestions((prev) =>
                            prev.map((x, j) => j === i ? { ...x, accepted: e.target.checked } : x),
                          )}
                          className="accent-violet-600"
                        />
                      </td>
                      <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground max-w-[120px] truncate" title={s.layerName}>
                        {s.layerName}
                      </td>
                      <td className="py-1.5 px-2">
                        <Badge variant="outline" className="text-[10px] py-0">{s.layerType}</Badge>
                      </td>
                      <td className="py-1.5 px-2 text-xs">{s.label || "—"}</td>
                      <td className="py-1.5 px-2">
                        {s.fieldKey ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${FIELD_KEY_COLORS[s.fieldKey] ?? "bg-gray-100 text-gray-600"}`}>
                            {s.fieldKey}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">decorative</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        <select
                          value={s.fieldKey}
                          onChange={(e) => setSuggestions((prev) =>
                            prev.map((x, j) => j === i ? { ...x, fieldKey: e.target.value, accepted: e.target.value !== "" } : x),
                          )}
                          className="text-xs border rounded px-1 py-0.5 bg-background"
                        >
                          {FIELD_KEYS.map((k) => (
                            <option key={k} value={k}>{k === "" ? "(decorative / skip)" : k}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!aiLoading && suggestions.length > 0 && (
            <DialogFooter className="border-t pt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {suggestions.filter((s) => s.accepted).length} of {suggestions.length} mappings selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAiOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={applyMappings}
                  disabled={suggestions.filter((s) => s.accepted).length === 0}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply {suggestions.filter((s) => s.accepted).length} Mappings
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
