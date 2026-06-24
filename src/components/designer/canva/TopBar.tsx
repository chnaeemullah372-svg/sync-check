import { Link } from "@tanstack/react-router";
import { ArrowLeft, Undo2, Redo2, MoreHorizontal, Check, Download, Maximize2 } from "lucide-react";
import { useDesigner } from "@/lib/designer/store";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveTemplate } from "@/lib/api/templates.functions";
import { useQueryClient } from "@tanstack/react-query";
import { clearDesignerAutosave } from "@/hooks/use-designer-autosave";
import { withMemberTemplateMeta } from "@/lib/designer/member-template";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface Props {
  userMode?: boolean;
  entryId?: string;
}

export function CanvaTopBar({ userMode, entryId }: Props) {
  const { undo, redo, history, future, userZoom, zoomReset } = useDesigner();
  const [saving, setSaving] = useState(false);
  const saveTemplateFn = useServerFn(saveTemplate);
  const qc = useQueryClient();

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
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  return (
    <header className="h-12 shrink-0 border-b bg-card px-1 flex items-center gap-0.5">
      <Link to={backTo as any} className="shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </Link>

      <Button
        variant="ghost" size="icon" className="h-9 w-9"
        onClick={undo} disabled={history.length === 0} title="Undo"
      >
        <Undo2 className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost" size="icon" className="h-9 w-9"
        onClick={redo} disabled={future.length === 0} title="Redo"
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

      <div
        className="ml-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        title="Deployment verification marker"
      >
        LIVE BUILD 24JUN-005
      </div>

      <div className="ml-auto flex items-center gap-1">
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
  );
}
