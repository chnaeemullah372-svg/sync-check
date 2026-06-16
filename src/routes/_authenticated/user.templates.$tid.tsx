import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import { createEntry, listMyEntries } from "@/lib/api/entries.functions";
import { toast } from "sonner";
import { UserShell } from "@/components/user/UserShell";

export const Route = createFileRoute("/_authenticated/user/templates/$tid")({
  head: () => ({ meta: [{ title: "Template" }] }),
  component: TemplateEntries,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-bold">Couldn't load this template</h1>
        <p className="text-sm text-muted-foreground break-words">{error?.message ?? "Unknown error"}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
          <a href="/user" className="rounded-md border px-4 py-2 text-sm font-medium">Go back</a>
        </div>
      </div>
    </div>
  ),
});

function TemplateEntries() {
  const { tid } = Route.useParams();
  const navigate = useNavigate();
  const [memberCount, setMemberCount] = useState(1);

  const { data: tpl } = useQuery({
    queryKey: ["template", tid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, name, category, width, height")
        .eq("id", tid)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const entriesFn = useServerFn(listMyEntries);
  const { data: entries, refetch } = useQuery({
    queryKey: ["entries", tid],
    queryFn: () => entriesFn({ data: { templateId: tid } }),
  });

  const createFn = useServerFn(createEntry);
  const create = useMutation({
    mutationFn: (count: number) => createFn({ data: { templateId: tid, memberCount: count } }),
    onSuccess: (res) => {
      toast.success(`Entry #${res.entry_no} created`);
      navigate({ to: "/user/entries/$entryId", params: { entryId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <UserShell title={tpl?.name ?? "Template"}>
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Link to="/user" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-user-muted hover:text-user-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
            </Link>
            <p className="text-xs font-black uppercase tracking-widest text-user-brand">
              {tpl?.category ?? "Template"}
            </p>
            <h1
              className="mt-1 text-3xl font-black tracking-normal text-user-ink"
            >
              {tpl?.name}
            </h1>
            <p className="mt-1 text-sm text-user-muted">Template Code: {tpl?.id?.slice(0, 8)} · Size: {tpl?.width}×{tpl?.height}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-md border border-user-border bg-user-surface px-2 py-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-user-muted">Members</span>
              <input
                type="number"
                min={1}
                max={20}
                value={memberCount}
                onChange={(e) => setMemberCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                className="h-8 w-16 rounded border border-user-border bg-user-page px-2 text-center text-sm font-bold text-user-ink"
              />
            </div>
            <Button
              disabled={create.isPending}
              onClick={() => create.mutate(memberCount)}
              className="h-10 rounded-md bg-user-sidebar-active px-4 text-xs font-bold uppercase tracking-wider text-user-sidebar-foreground shadow-sm hover:bg-user-sidebar-active/90"
            >
              <Plus className="h-4 w-4" /> Create New Entry
            </Button>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-user-muted">
            All Entries
          </h2>
          {!entries ? (
            <p className="text-sm text-user-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <Card className="border-dashed border-user-border bg-user-surface p-8 text-center">
              <FileText className="mx-auto mb-2 h-10 w-10 text-user-muted" />
              <p className="text-sm text-user-muted">No entries yet. Tap “Create New Entry” to start.</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-user-border bg-user-surface">
              {entries.map((e: any) => (
                <Link
                  key={e.id}
                  to="/user/entries/$entryId"
                  params={{ entryId: e.id }}
                  className="grid grid-cols-[1fr_80px_110px_80px] items-center gap-3 border-b border-user-border px-4 py-3 text-sm last:border-b-0 hover:bg-user-page"
                >
                  <span className="font-bold text-user-ink">Entry #{e.entry_no}</span>
                  <span className="capitalize text-user-brand">{e.status}</span>
                  <span className="truncate text-xs text-user-muted">{new Date(e.updated_at).toLocaleString()}</span>
                  <span className="rounded-md border border-user-border px-3 py-1 text-center text-xs font-bold text-user-sidebar-active">Open</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </UserShell>
  );
}
