import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createEntry, listMyTemplates } from "@/lib/api/entries.functions";
import { ArrowRight, FilePlus2, History, LayoutTemplate } from "lucide-react";

import { UserShell } from "@/components/user/UserShell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/user/")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: UserDashboard,
});

function UserDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (role === "admin") navigate({ to: "/card/admin", replace: true });
  }, [role, navigate]);

  const tplFn = useServerFn(listMyTemplates);
  const createFn = useServerFn(createEntry);
  const { data: templates } = useQuery({ queryKey: ["my-templates"], queryFn: () => tplFn() });


  const create = useMutation({
    mutationFn: (templateId: string) => createFn({ data: { templateId } }),
    onSuccess: (res) => {
      toast.success(`Entry #${res.entry_no} created`);
      navigate({ to: "/user/entries/$entryId", params: { entryId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <UserShell title="My Templates">
      <div className="space-y-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-user-brand">User Dashboard</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-user-ink">My Templates</h1>
            <p className="mt-1 text-sm text-user-muted">Templates assigned to you by administrator</p>
          </div>
          <Link to="/user/history">
            <Button variant="outline" className="border-user-border bg-user-surface">
              <History className="h-4 w-4" /> History
            </Button>
          </Link>
        </div>

        <section>
          {!templates ? (
            <p className="text-sm text-user-muted">Loading templates…</p>
          ) : templates.length === 0 ? (
            <Card className="border-dashed border-user-border bg-user-surface p-10 text-center">
              <LayoutTemplate className="mx-auto mb-3 h-11 w-11 text-user-muted" />
              <p className="text-sm text-user-muted">
                No templates assigned yet. Ask your admin to assign one.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((t: any) => (
                <Card key={t.id} className="group overflow-hidden border-user-border bg-user-surface p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
                  <Link to="/user/templates/$tid" params={{ tid: t.id }} className="block">
                    <div className="aspect-[4/3] bg-user-brand-soft p-4">
                      {t.background_url ? (
                        <img src={t.background_url} alt={`${t.name} template preview`} className="h-full w-full rounded-md border border-user-border bg-user-surface object-contain shadow-sm" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-user-border bg-user-surface">
                          <LayoutTemplate className="h-12 w-12 text-user-muted" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="space-y-4 p-4">
                    <div>
                      <h2 className="truncate text-lg font-black tracking-normal text-user-ink">{t.name}</h2>
                      <p className="mt-1 text-xs text-user-muted">{t.category ?? "Admin Template"} · {t.width}×{t.height}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={create.isPending} onClick={() => create.mutate(t.id)} className="flex-1 bg-user-sidebar-active text-user-sidebar-foreground hover:bg-user-sidebar-active/90">
                        <FilePlus2 className="h-4 w-4" /> Create Entry
                      </Button>
                      <Link to="/user/templates/$tid" params={{ tid: t.id }}>
                        <Button variant="outline" className="border-user-border bg-user-surface px-3">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>



      </div>
    </UserShell>
  );
}
