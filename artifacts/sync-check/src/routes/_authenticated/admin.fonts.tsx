import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Trash2, Loader2, Type } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/fonts")({
  head: () => ({ meta: [{ title: "Fonts" }] }),
  component: AdminFontsPage,
});

interface FontRow {
  id: string;
  name: string;
  family: string;
  file_path: string;
  format: string;
  aliases: string[];
  language: string | null;
  created_at: string;
}

function detectFormat(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  return "truetype";
}

function AdminFontsPage() {
  const { role, loading, user } = useAuth();
  const isAdmin = !!user && role === "admin";

  const [rows, setRows] = useState<FontRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [family, setFamily] = useState("");
  const [aliases, setAliases] = useState("");
  const [language, setLanguage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const load = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("fonts")
      .select("*")
      .order("created_at", { ascending: false });
    setBusy(false);
    if (error) return toast.error(error.message);
    setRows((data || []) as FontRow[]);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const upload = async () => {
    if (!pendingFile) return toast.error("Choose a font file first");
    if (!family.trim()) return toast.error("Font family name is required");
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "ttf";
      const safe = family.trim().replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
      const path = `${safe}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fonts")
        .upload(path, pendingFile, { upsert: false, contentType: pendingFile.type || "font/ttf" });
      if (upErr) throw upErr;

      const aliasArr = aliases
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error: insErr } = await supabase.from("fonts").insert({
        name: family.trim(),
        family: family.trim(),
        file_path: path,
        format: detectFormat(pendingFile.name),
        aliases: aliasArr,
        language: language.trim() || null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      toast.success(`Uploaded "${family.trim()}" — refresh designer to use it`);
      setFamily("");
      setAliases("");
      setLanguage("");
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (row: FontRow) => {
    if (!confirm(`Delete font "${row.name}"?`)) return;
    await supabase.storage.from("fonts").remove([row.file_path]);
    const { error } = await supabase.from("fonts").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Font deleted");
    load();
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Admin access required.{" "}
        <Link to="/user" className="text-primary underline">
          Back
        </Link>
      </div>
    );

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/card/admin" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4 mr-1" />
          Back
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Type className="h-5 w-5" /> Custom Fonts
        </h1>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Upload a font (TTF / OTF / WOFF / WOFF2)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Font family name</Label>
            <Input
              placeholder="e.g. Jameel Noori Nastaleeq"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This is the CSS family used in the designer.
            </p>
          </div>
          <div>
            <Label>Aliases (comma separated, optional)</Label>
            <Input
              placeholder="e.g. JameelNooriNastaleeq, Jameel Noori"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              PSD font names that should map to this font (so imports don't fall back).
            </p>
          </div>
          <div>
            <Label>Language tag (optional)</Label>
            <Input
              placeholder="urdu / arabic / english"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>
          <div>
            <Label>Font file</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <Button onClick={upload} disabled={uploading || !pendingFile || !family.trim()}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload font
            </>
          )}
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium">Installed fonts</h2>
          <span className="text-xs text-muted-foreground">{rows.length} font(s)</span>
        </div>
        {busy ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No custom fonts yet. Upload a .ttf to make it available to everyone.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="font-medium truncate"
                    style={{ fontFamily: `"${r.family}"` }}
                  >
                    {r.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.family}
                    {r.aliases?.length ? ` · aliases: ${r.aliases.join(", ")}` : ""}
                    {r.language ? ` · ${r.language}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
