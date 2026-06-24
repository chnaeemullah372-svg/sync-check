import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash, Trash2 } from "lucide-react";
import { listMyEntries, deleteEntry, deleteAllMyEntries } from "@/lib/api/entries.functions";
import { toast } from "sonner";
import { UserShell } from "@/components/user/UserShell";

export const Route = createFileRoute("/_authenticated/user/history")({
  head: () => ({ meta: [{ title: "History" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyEntries);
  const delFn = useServerFn(deleteEntry);
  const wipeFn = useServerFn(deleteAllMyEntries);
  const { data: entries } = useQuery({
    queryKey: ["my-entries"],
    queryFn: () => listFn({ data: {} }),
  });
  const del = useMutation({
    mutationFn: (entryId: string) => delFn({ data: { entryId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-entries"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const wipe = useMutation({
    mutationFn: () => wipeFn({ data: {} }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["my-entries"] });
      toast.success(`Wiped ${r.count} entries`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <UserShell title="History">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/user" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-user-muted hover:text-user-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
            </Link>
            <p className="text-xs font-black uppercase tracking-widest text-user-brand">History</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-user-ink">All entries</h1>
          </div>
          {entries && entries.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={wipe.isPending}
              onClick={() => {
                if (confirm(`Permanently delete ALL ${entries.length} entries? This cannot be undone.`)) {
                  wipe.mutate();
                }
              }}
              className="border-rose-300 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash className="h-4 w-4" /> Wipe All History
            </Button>
          )}
        </div>
        {!entries ? (
          <p className="text-sm text-user-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <Card className="border-dashed border-user-border bg-user-surface p-8 text-center text-sm text-user-muted">
            No entries yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map((e: any) => (
              <Card key={e.id} className="flex items-center gap-3 border-user-border bg-user-surface p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-user-brand text-xs font-black text-user-sidebar-foreground">
                  #{e.entry_no}
                </div>
                <Link
                  to="/user/entries/$entryId"
                  params={{ entryId: e.id }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-black text-user-ink">
                    {e.templates?.name ?? "Template"}
                  </p>
                  <p className="text-[11px] text-user-muted">
                    {e.status} · {new Date(e.updated_at).toLocaleString()}
                  </p>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this entry?")) del.mutate(e.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </UserShell>
  );
}
