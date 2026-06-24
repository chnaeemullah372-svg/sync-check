import { A4_PORTRAIT, makeId, useDesigner } from "@/lib/designer/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Save, FolderOpen,
  Upload, Ruler, ChevronDown, FileText, LayoutTemplate, Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { toast } from "sonner";
import type { Layer } from "@/lib/designer/types";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { useServerFn } from "@tanstack/react-start";
import { saveTemplate } from "@/lib/api/templates.functions";
import { useQueryClient } from "@tanstack/react-query";
import { clearDesignerAutosave } from "@/hooks/use-designer-autosave";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";


export function Toolbar({ stageRef, userMode = false, entryId }: { stageRef: React.MutableRefObject<Konva.Stage | null>; userMode?: boolean; entryId?: string }) {
  const [, setTemplateTick] = useState(0);
  const templateImportRef = useRef<HTMLInputElement>(null);
  const imageImportRef = useRef<HTMLInputElement>(null);
  const pdfImportRef = useRef<HTMLInputElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);
  const [aiInstructions, setAiInstructions] = useState<string>(() => {
    try { return localStorage.getItem("designer.aiInstructions") ?? ""; } catch { return ""; }
  });
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem("designer.aiInstructions", aiInstructions); } catch { /* ignore */ }
  }, [aiInstructions]);
  const {
    setSize, sizePreset, canvasWidth, canvasHeight,
    undo, redo, history, future,
    userZoom, zoomIn, zoomOut, zoomReset,
    setBackground, saveTemplateLocal, loadState,
  } = useDesigner();


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault(); if (e.shiftKey) redo(); else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault(); redo();
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); zoomIn();
      } else if (mod && e.key === "-") {
        e.preventDefault(); zoomOut();
      } else if (mod && e.key === "0") {
        e.preventDefault(); zoomReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, zoomIn, zoomOut, zoomReset]);

  const readFileAsDataURL = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("File could not be read"));
    reader.readAsDataURL(file);
  });

  const importImageTemplate = async (file: File) => {
    try {
      const src = await readFileAsDataURL(file);
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        setBackground({ src, width: w, height: h });
        setSize("custom", w, h);
        toast.success("Template imported and canvas set to its size");
      };
      img.onerror = () => toast.error("Image could not be imported");
      img.src = src;
    } catch (err: any) {
      toast.error(String(err?.message || err));
    }
  };

  const importPdfTemplate = async (file: File) => {
    try {
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const page = await pdf.getPage(1);
      const pageSize = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      await page.render({ canvasContext: context as any, viewport }).promise;
      const src = canvas.toDataURL("image/png");
      const w = Math.round(pageSize.width);
      const h = Math.round(pageSize.height);
      setBackground({ src, width: w, height: h });
      setSize("custom", w, h);
      toast.success("PDF template imported and canvas set to its size");
    } catch (err: any) {
      console.error("[pdf import] failed", err);
      toast.error(`PDF import failed: ${String(err?.message || err)}`);
    }
  };

  const importTemplateFile = (file: File) => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      void importPdfTemplate(file);
      return;
    }
    void importImageTemplate(file);
  };

  const importProjectTemplate = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid template file");
      loadState({
        background: parsed.background,
        canvasWidth: parsed.canvasWidth,
        canvasHeight: parsed.canvasHeight,
        layers: parsed.layers,
        memberNames: parsed.memberNames || {},
      });
      toast.success("Project template imported");
    } catch (err: any) {
      toast.error(`Template file failed: ${String(err?.message || err)}`);
    }
  };

  const saveProjectFile = () => {
    const state = useDesigner.getState();
    const payload = {
      name: `Template ${new Date().toLocaleString()}`,
      savedAt: Date.now(),
      background: state.background,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      layers: state.layers,
      memberNames: state.memberNames,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-project.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Project file saved");
  };

  const saveTemplateFn = useServerFn(saveTemplate);
  const qc = useQueryClient();
  const [savingDb, setSavingDb] = useState(false);
  const navigate = useNavigate();

  const onSaveTemplate = async () => {
    const currentTid = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("designer.currentTemplateId") : null;
    const currentName = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("designer.currentTemplateName") : null;
    const defaultName = currentName || `Template ${new Date().toLocaleString()}`;
    const name = prompt(currentTid ? "Update template name?" : "New template name?", defaultName);
    if (name === null) return;
    const finalName = name.trim() || defaultName;

    // local copy first (offline backup)
    saveTemplateLocal(finalName);
    setTemplateTick((n) => n + 1);

    const state = useDesigner.getState();
    const snapshot = {
      layers: state.layers,
      memberNames: state.memberNames,
      background: state.background,
    };
    try {
      setSavingDb(true);
      const res = await saveTemplateFn({
        data: {
          templateId: currentTid ?? undefined,
          name: finalName,
          pageSize: state.sizePreset,
          width: state.canvasWidth,
          height: state.canvasHeight,
          backgroundUrl: state.background?.src ?? null,
          snapshot,
          aiInstructions: aiInstructions.trim() || null,
        },
      });
      try {
        if (res?.id) {
          sessionStorage.setItem("designer.currentTemplateId", res.id);
          sessionStorage.setItem("designer.currentTemplateName", finalName);
        }
      } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      qc.invalidateQueries({ queryKey: ["admin-templates-min"] });
      qc.invalidateQueries({ queryKey: ["my-templates"] });
      clearDesignerAutosave();
      toast.success(currentTid ? `Template updated: ${finalName}` : `Template saved: ${finalName}`);
      if (!userMode) navigate({ to: "/card/admin" });
    } catch (e: any) {
      toast.error(`Library save failed: ${e?.message || e}. Saved locally only.`);
    } finally {
      setSavingDb(false);
    }
  };


  const loadGalleryTemplate = (kind: "blank" | "member") => {
    if (kind === "blank") {
      loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers: [], memberNames: {} });
      setSize("a4p");
      toast.success("Blank A4 template loaded");
      return;
    }
    const layers: Layer[] = [
      { id: makeId(), name: "Photo Box", type: "image", x: 574, y: 82, width: 140, height: 175, rotation: 0, opacity: 1, visible: true, locked: false, src: null, fit: "crop", subtype: "photo", fieldKey: "photo", slotIndex: 1 },
      { id: makeId(), name: "Name", type: "text", x: 90, y: 95, width: 410, height: 34, rotation: 0, opacity: 1, visible: true, locked: false, text: "Name", fontSize: 22, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "name", slotIndex: 1 },
      { id: makeId(), name: "Father Name", type: "text", x: 90, y: 145, width: 410, height: 32, rotation: 0, opacity: 1, visible: true, locked: false, text: "Father Name", fontSize: 20, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "father_name", slotIndex: 1 },
      { id: makeId(), name: "CNIC", type: "text", x: 90, y: 195, width: 410, height: 32, rotation: 0, opacity: 1, visible: true, locked: false, text: "CNIC", fontSize: 20, fontFamily: "Arial", fontStyle: "normal", fill: "#111827", align: "left", fieldKey: "cnic", slotIndex: 1 },
      { id: makeId(), name: "Thumb Box", type: "image", x: 100, y: 285, width: 118, height: 118, rotation: 0, opacity: 1, visible: true, locked: false, src: null, fit: "fit", subtype: "thumb", fieldKey: "thumb", slotIndex: 1 },
      { id: makeId(), name: "Signature Box", type: "image", x: 278, y: 314, width: 220, height: 74, rotation: 0, opacity: 1, visible: true, locked: false, src: null, fit: "fit", subtype: "signature", fieldKey: "signature", slotIndex: 1 },
    ];
    loadState({ background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h }, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h, layers, memberNames: { 1: "Member 1" } });
    setSize("a4p");
    toast.success("Member template loaded");
  };


  const sizeLabel =
    sizePreset === "a4p" ? "A4 P" :
    sizePreset === "a4l" ? "A4 L" :
    sizePreset === "original" ? "Orig" : "Custom";

  return (
    <div className="border-b bg-card px-2 h-10 flex items-center gap-0.5 text-xs shrink-0 overflow-x-auto">
      <input ref={imageImportRef} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importImageTemplate(file);
          e.currentTarget.value = "";
        }} />
      <input ref={templateImportRef} type="file" accept="image/png,image/jpeg,application/pdf,.pdf" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importTemplateFile(file);
          e.currentTarget.value = "";
        }} />
      <input ref={pdfImportRef} type="file" accept="application/pdf" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importPdfTemplate(file);
          e.currentTarget.value = "";
        }} />
      <input ref={projectImportRef} type="file" accept="application/json,.json" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importProjectTemplate(file);
          e.currentTarget.value = "";
        }} />

      {/* Back link — to admin for admins, to entry for users */}
      {userMode && entryId ? (
        <Link to="/user/entries/$entryId" params={{ entryId }} className="shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Back to entry">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
      ) : (
        <Link to="/card/admin" className="shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Back to Admin">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
      )}

      {/* History */}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)">
        <Undo2 className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
        <Redo2 className="w-4 h-4" />
      </Button>

      <div className="h-5 w-px bg-border mx-1 shrink-0" />

      {/* Zoom */}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={zoomOut} title="Zoom out (Ctrl+-)">
        <ZoomOut className="w-4 h-4" />
      </Button>
      <button onClick={zoomReset} className="px-1.5 h-7 border rounded text-[11px] hover:bg-accent min-w-[2.75rem] shrink-0" title="Reset zoom (Ctrl+0)">
        {Math.round(userZoom * 100)}%
      </button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={zoomIn} title="Zoom in (Ctrl++)">
        <ZoomIn className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={zoomReset} title="Fit (100%)">
        <Maximize2 className="w-4 h-4" />
      </Button>

      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {/* USER MODE: local save + download only. No AI Command, no DB save. */}
        {userMode ? (
          <>
            <Button
              size="sm"
              variant="default"
              className="h-8 px-2"
              title="Save your edits to this device only (admin template is not affected)"
              onClick={() => {
                if (!entryId) { toast.error("Missing entry id"); return; }
                const s = useDesigner.getState();
                const payload = {
                  background: s.background,
                  canvasWidth: s.canvasWidth,
                  canvasHeight: s.canvasHeight,
                  layers: s.layers,
                  memberNames: s.memberNames,
                  savedAt: Date.now(),
                };
                try {
                  localStorage.setItem(`designer.userEdit.${entryId}`, JSON.stringify(payload));
                  toast.success("Saved on this device");
                } catch (e: any) {
                  toast.error(`Local save failed: ${e?.message || e}`);
                }
              }}
            >
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              title="Download your edits as a project file"
              onClick={saveProjectFile}
            >
              <Upload className="w-3.5 h-3.5 mr-1 rotate-180" /> Download
            </Button>
          </>
        ) : (
          <>
            {/* AI Command — admin instructions for the AI on the user side */}
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant={aiInstructions.trim() ? "default" : "outline"} className="h-8 px-2" title="AI Command">
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Command
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>AI Command (admin instructions)</DialogTitle>
                  <DialogDescription>
                    Tell the AI exactly what to do when filling this template on the user side. Include rules for each field — e.g. "Name box → Urdu only", "Photo box → passport-size head shot, crop face", "Address1 = موجودہ پتہ، Address2 = مستقل پتہ".
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={10}
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  placeholder={`Examples:\n- Name: write in Urdu in "Name", English transliteration in "Name (EN)".\n- Photo: passport-size, face centered, white background.\n- Address1 = current address, Address2 = permanent address.\n- Dates: DD-MM-YYYY.\n`}
                  dir="auto"
                  className="text-xs"
                />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAiInstructions("")}>Clear</Button>
                  <Button onClick={() => { setAiDialogOpen(false); toast.success("AI command saved — included with next template save"); }}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Templates dropdown — visible, separate from Save */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 px-2">
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1" /> Templates <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Template gallery</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => templateImportRef.current?.click()} className="font-medium">
                  <Upload className="w-3.5 h-3.5 mr-2" /> Import template…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => loadGalleryTemplate("blank")}>
                  <LayoutTemplate className="w-3.5 h-3.5 mr-2" /> Blank A4
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => loadGalleryTemplate("member")}>
                  <LayoutTemplate className="w-3.5 h-3.5 mr-2" /> Member form starter
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Saved templates</DropdownMenuLabel>
                <DropdownMenuItem disabled={savingDb} onClick={() => void onSaveTemplate()}>
                  <Save className="w-3.5 h-3.5 mr-2" /> {savingDb ? "Saving…" : "Save template…"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <Link to="/card/admin">
                  <DropdownMenuItem>
                    <FolderOpen className="w-3.5 h-3.5 mr-2" /> Manage saved templates…
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Size dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 px-2">
              <Ruler className="w-3.5 h-3.5 mr-1" /> {sizeLabel} <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Canvas size</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSize("a4p")}>A4 Portrait</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSize("a4l")}>A4 Landscape</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSize("original")}>Original BG</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const wStr = prompt("Canvas width (px)", String(canvasWidth));
                if (wStr === null) return;
                const hStr = prompt("Canvas height (px)", String(canvasHeight));
                if (hStr === null) return;
                const w = Math.max(50, Math.round(Number(wStr) || canvasWidth));
                const h = Math.max(50, Math.round(Number(hStr) || canvasHeight));
                setSize("custom", w, h);
              }}
            >
              Custom size…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Import dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" className="h-8 px-2">
              <Upload className="w-3.5 h-3.5 mr-1" /> Import <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Import as template</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => imageImportRef.current?.click()}>
              <ImageIcon className="w-3.5 h-3.5 mr-2" /> Import PNG / JPG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pdfImportRef.current?.click()}>
              <FileText className="w-3.5 h-3.5 mr-2" /> Import PDF document
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Project file</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => projectImportRef.current?.click()}>
              <FolderOpen className="w-3.5 h-3.5 mr-2" /> Import saved project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={saveProjectFile}>
              <Save className="w-3.5 h-3.5 mr-2" /> Save project file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sizePreset === "custom" && (
        <div className="flex items-center gap-1 ml-1 shrink-0">
          <Input type="number" className="w-16 h-7 text-xs" value={canvasWidth}
            onChange={(e) => setSize("custom", Number(e.target.value), canvasHeight)} />
          <span className="text-[10px] text-muted-foreground">×</span>
          <Input type="number" className="w-16 h-7 text-xs" value={canvasHeight}
            onChange={(e) => setSize("custom", canvasWidth, Number(e.target.value))} />
        </div>
      )}
    </div>
  );
}
