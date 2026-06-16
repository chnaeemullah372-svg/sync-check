import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users as UsersIcon,
  LayoutTemplate,
  Plus,
  Pencil,
  Archive,
  Trash2,
  KeyRound,
  Ban,
  CheckCircle2,
  RotateCcw,
  Copy,
  Eye,
  EyeOff,
  LogOut,
  Menu,
  MoreVertical,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  adminCreateUser,
  adminListUsers,
  adminSetUserTemplates,
  adminSetTemplateArchived,
  adminDeleteTemplate,
  adminSetUserDisabled,
  adminResetPassword,
  adminDeleteUser,
} from "@/lib/api/admin.functions";
import { duplicateTemplateFn } from "@/lib/api/templates.functions";
import { useBackButtonClose } from "@/hooks/use-back-close";
import { NewTemplateModal } from "@/components/designer/NewTemplateModal";

export const Route = createFileRoute("/_authenticated/card/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard" }] }),
  component: AdminDashboard,
});

type Tab = "overview" | "users" | "templates" | "archive";

const NAV: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "archive", label: "Archive", icon: Archive },
];

const BRAND_RED = "#e85d3a"; // ember accent (kept variable name for minimal diff)
const INK = "#1a1a1a";

function AdminDashboard() {
  const router = useRouter();
  const { user, role, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTplOpen, setNewTplOpen] = useState(false);
  useEffect(() => {
    const open = () => setNewTplOpen(true);
    window.addEventListener("admin:new-template", open);
    return () => window.removeEventListener("admin:new-template", open);
  }, []);
  useBackButtonClose(drawerOpen, () => setDrawerOpen(false));

  // Keep Admin as a one-screen workspace on mobile: Back closes dialogs/drawers,
  // and if no overlay is open it stays on Admin instead of leaving the page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState(
      { ...(window.history.state ?? {}), __adminRoot: 1 },
      "",
      window.location.href,
    );
    window.history.pushState(
      { ...(window.history.state ?? {}), __adminGuard: 1 },
      "",
      window.location.href,
    );
    const onPop = (event: PopStateEvent) => {
      const overlayOpen = !!document.querySelector('[role="dialog"]');
      if (overlayOpen) return;
      if (!event.state?.__adminRoot && !event.state?.__adminGuard) return;
      setTab("overview");
      window.history.pushState(
        { ...(window.history.state ?? {}), __adminGuard: 1 },
        "",
        window.location.href,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router.state.location.href]);

  if (loading || !user || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <h1 className="text-xl font-bold">Admin access only</h1>
        <Link to="/user">
          <Button>Go to user dashboard</Button>
        </Link>
      </div>
    );
  }

  const activeNav = NAV.find((n) => n.id === tab)!;

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-[color:var(--color-ink)]">
      {/* Top bar — single column app shell */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: INK, color: "#f5f4f1", borderColor: "#000" }}
      >
        <div className="max-w-3xl mx-auto h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 active:scale-95 transition lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-7 w-7 rounded-md flex items-center justify-center font-black text-sm shrink-0"
                style={{
                  backgroundColor: BRAND_RED,
                  color: INK,
                  fontFamily: "var(--font-display)",
                }}
              >
                T
              </span>
              <span
                className="font-bold tracking-tight text-base truncate"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Template <span style={{ color: BRAND_RED }}>Studio</span>
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Pill tab strip — single-column nav (desktop + tablet) */}
        <nav className="hidden lg:block border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                    active ? "text-white" : "text-white/50 hover:text-white border-transparent"
                  }`}
                  style={active ? { borderColor: BRAND_RED } : {}}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </button>
              );
            })}
            <Link
              to="/admin/ai-settings"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white border-b-2 border-transparent"
            >
              <Sparkles className="h-4 w-4" /> AI Settings
            </Link>
          </div>
        </nav>
      </header>

      {/* Drawer for mobile */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 flex flex-col"
          style={{ backgroundColor: INK, color: "#f5f4f1" }}
        >
          <div className="p-6 border-b border-white/10">
            <div
              className="font-bold text-lg tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Template <span style={{ color: BRAND_RED }}>Studio</span>
            </div>
            <p className="text-xs text-white/50 mt-1 truncate">{user?.email}</p>
          </div>
          <nav className="p-3 flex-1 space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    setTab(n.id);
                    setDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? BRAND_RED : "transparent",
                    color: active ? INK : "rgba(255,255,255,0.7)",
                  }}
                >
                  <Icon className="h-5 w-5" />
                  {n.label}
                </button>
              );
            })}
            <Link
              to="/admin/ai-settings"
              onClick={() => setDrawerOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              <Sparkles className="h-5 w-5" /> AI Settings
            </Link>
          </nav>
          <div className="p-3 border-t border-white/10">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Single-column page */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="mb-6">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: BRAND_RED }}
          >
            {activeNav.label}
          </p>
          <div className="flex items-end justify-between gap-3 mt-1">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {tab === "overview" && "Dashboard"}
              {tab === "users" && "Users"}
              {tab === "templates" && "Templates"}
              {tab === "archive" && "Archive"}
            </h1>
            {tab === "users" && (
              <div className="flex items-center gap-2">
                <Link to="/admin/ai-settings">
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-md text-xs font-bold uppercase tracking-wider"
                  >
                    AI Settings
                  </Button>
                </Link>
                <CreateUserButton />
              </div>
            )}
            {tab === "templates" && (
              <Button
                onClick={() => setNewTplOpen(true)}
                className="h-10 px-4 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: BRAND_RED, color: INK }}
              >
                <Plus className="h-4 w-4" /> New Template
              </Button>
            )}
          </div>
        </div>

        <NewTemplateModal open={newTplOpen} onOpenChange={setNewTplOpen} />

        {tab === "overview" && <OverviewTab onGo={setTab} />}
        {tab === "users" && <UsersTab />}
        {tab === "templates" && <TemplatesTab archivedView={false} />}
        {tab === "archive" && <TemplatesTab archivedView={true} />}
      </main>
    </div>
  );
}

/* ---------------- Create User button ---------------- */

function CreateUserButton() {
  return (
    <Button
      className="h-10 px-4 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm"
      style={{ backgroundColor: BRAND_RED, color: INK }}
      onClick={() => window.dispatchEvent(new CustomEvent("admin:create-user"))}
    >
      <Plus className="h-4 w-4" /> Add User
    </Button>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab({ onGo }: { onGo: (t: Tab) => void }) {
  const listFn = useServerFn(adminListUsers);
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  const { data: templates } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, archived_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const active = templates?.filter((t) => !t.archived_at).length ?? 0;
  const archived = templates?.filter((t) => t.archived_at).length ?? 0;
  const totalUsers = users?.length ?? 0;
  const disabledUsers = users?.filter((u) => u.banned).length ?? 0;

  const stats = [
    { label: "Total Users", value: totalUsers, icon: UsersIcon, tint: "bg-blue-50 text-blue-600" },
    {
      label: "Active Templates",
      value: active,
      icon: LayoutTemplate,
      tint: "bg-emerald-50 text-emerald-600",
    },
    { label: "Archived", value: archived, icon: Archive, tint: "bg-amber-50 text-amber-600" },
    { label: "Disabled", value: disabledUsers, icon: Ban, tint: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4 border-slate-200 shadow-sm">
              <div className={`${s.tint} w-9 h-9 rounded-lg flex items-center justify-center mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            icon={UsersIcon}
            title="Create User"
            desc="Add new user + assign templates"
            onClick={() => onGo("users")}
          />
          <QuickAction icon={Plus} title="New Template" desc="Choose a starting point" onClick={() => window.dispatchEvent(new CustomEvent("admin:new-template"))} />
          <QuickAction
            icon={LayoutTemplate}
            title="Manage Templates"
            desc="Edit, archive or delete"
            onClick={() => onGo("templates")}
          />
          <QuickAction
            icon={Sparkles}
            title="AI Settings"
            desc="Mode, provider & per-user access"
            to="/admin/ai-settings"
          />
          <QuickAction
            icon={Archive}
            title="Archive"
            desc="Restore or permanently delete"
            onClick={() => onGo("archive")}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  onClick?: () => void;
  to?: string;
}) {
  const body = (
    <Card className="p-4 flex items-center gap-3 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full border-slate-200">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: BRAND_RED }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-slate-900 truncate">{title}</div>
        <div className="text-xs text-slate-500 truncate">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 ml-auto shrink-0" />
    </Card>
  );
  if (to) return <Link to={to}>{body}</Link>;
  return (
    <button className="text-left w-full" onClick={onClick}>
      {body}
    </button>
  );
}

/* ---------------- Templates Tab ---------------- */

function TemplatesTab({ archivedView }: { archivedView: boolean }) {
  const qc = useQueryClient();
  const archiveFn = useServerFn(adminSetTemplateArchived);
  const deleteFn = useServerFn(adminDeleteTemplate);
  const duplicateFn = useServerFn(duplicateTemplateFn);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, name, category, status, archived_at, width, height, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const archive = useMutation({
    mutationFn: (v: { templateId: string; archived: boolean }) => archiveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (templateId: string) => deleteFn({ data: { templateId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dup = useMutation({
    mutationFn: (templateId: string) => duplicateFn({ data: { templateId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
      toast.success("Duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  const list = templates?.filter((t) => (archivedView ? !!t.archived_at : !t.archived_at)) ?? [];

  if (list.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed border-slate-300 bg-white">
        <LayoutTemplate className="h-10 w-10 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">
          {archivedView ? "No archived templates." : "No templates yet."}
        </p>
        {!archivedView && (
          <Link to="/designer" className="inline-block mt-3">
            <Button
              size="sm"
              className="rounded-full font-bold"
              style={{ backgroundColor: BRAND_RED }}
            >
              <Plus className="h-4 w-4" /> Create your first template
            </Button>
          </Link>
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {list.map((t) => {
        const safeName = (t.name || t.category || `Template ${String(t.id).slice(0, 8)}`).trim();
        return (
        <Card key={t.id} className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
              style={{ backgroundColor: BRAND_RED }}
            >
              {safeName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 truncate">{safeName}</h3>
                {t.archived_at ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    Archived
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {t.category ?? "Uncategorized"} · {t.width}×{t.height}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {!archivedView && (
                  <>
                    <Link to="/designer" search={{ tid: t.id }}>
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4 mr-2" /> Edit in Designer
                      </DropdownMenuItem>
                    </Link>
                    <Link to="/user/templates/$tid" params={{ tid: t.id }}>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" /> Preview / View
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={() => dup.mutate(t.id)}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                  </>
                )}
                {archivedView ? (
                  <DropdownMenuItem
                    onClick={() => archive.mutate({ templateId: t.id, archived: false })}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => archive.mutate({ templateId: t.id, archived: true })}
                  >
                    <Archive className="h-4 w-4 mr-2" /> Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => {
                    if (confirm(`Delete "${safeName}" permanently?`)) del.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
        );
      })}
    </div>
  );
}

/* ---------------- Users Tab ---------------- */

function UsersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const disableFn = useServerFn(adminSetUserDisabled);
  const resetFn = useServerFn(adminResetPassword);
  const deleteFn = useServerFn(adminDeleteUser);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const { data: templates } = useQuery({
    queryKey: ["admin-templates-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, name, category")
        .is("archived_at", null)
        .order("name");
      return data ?? [];
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [assignTo, setAssignTo] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<{ id: string; email: string } | null>(null);

  // Listen for the header "ADD USER" event
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener("admin:create-user", handler);
    return () => window.removeEventListener("admin:create-user", handler);
  }, []);

  const disable = useMutation({
    mutationFn: (v: { userId: string; disabled: boolean }) => disableFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{users?.length ?? 0} users total</p>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !users || users.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-slate-300 bg-white">
          <UsersIcon className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No users yet.</p>
          <Button
            className="mt-3 rounded-full font-bold"
            style={{ backgroundColor: BRAND_RED }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create first user
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => {
            const initials = (u.displayName ?? u.email).slice(0, 2).toUpperCase();
            return (
              <Card
                key={u.id}
                className={`p-4 border-slate-200 shadow-sm ${u.banned ? "opacity-70" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: BRAND_RED }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 truncate">
                        {u.displayName ?? u.email}
                      </h3>
                      {u.banned ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                          Disabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {u.templateIds.length} template{u.templateIds.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => setAssignTo(u.id)}>
                        <LayoutTemplate className="h-4 w-4 mr-2" /> Assign Templates
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetUser({ id: u.id, email: u.email })}>
                        <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => disable.mutate({ userId: u.id, disabled: !u.banned })}
                      >
                        {u.banned ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Enable Account
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4 mr-2" /> Disable Account
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => {
                          if (confirm(`Delete ${u.email}? This cannot be undone.`)) {
                            removeUser.mutate(u.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAssignTo(u.id)}
                      className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-100"
                    >
                      TEMPLATES
                    </button>
                    <button
                      onClick={() => setResetUser({ id: u.id, email: u.email })}
                      className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                    >
                      PASSWORD
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${u.email}? This cannot be undone.`))
                        removeUser.mutate(u.id);
                    }}
                    className="h-7 w-7 inline-flex items-center justify-center rounded bg-red-50 text-red-500 hover:bg-red-100"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={templates ?? []}
      />
      <AssignDialog
        userId={assignTo}
        users={users ?? []}
        templates={templates ?? []}
        onClose={() => setAssignTo(null)}
      />
      <ResetPasswordDialog
        target={resetUser}
        onClose={() => setResetUser(null)}
        resetFn={resetFn}
      />
    </div>
  );
}

/* ---------------- Create User Dialog ---------------- */

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function CreateUserDialog({
  open,
  onClose,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  templates: Array<{ id: string; name: string; category: string | null }>;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);
  const setTplFn = useServerFn(adminSetUserTemplates);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => genPassword());
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useBackButtonClose(open, onClose);

  useEffect(() => {
    if (open) {
      setEmail("");
      setDisplayName("");
      setPassword(genPassword());
      setSelected(new Set());
      setShowPw(true);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      const u = await createFn({
        data: { email: email.trim(), password, displayName: displayName.trim() || undefined },
      });
      if (selected.size > 0) {
        await setTplFn({ data: { userId: u.id, templateIds: [...selected] } });
      }
      return u;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const copyCreds = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    toast.success("Credentials copied");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>Set credentials and assign templates.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="dn">Display name (optional)</Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="em">Email</Label>
            <Input
              id="em"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 6 chars"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPassword(genPassword())}
                title="Generate"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyCreds}
                title="Copy email + password"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Assign templates ({selected.size} selected)</Label>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2 mt-1">
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-3">
                  No templates available yet.
                </p>
              ) : (
                templates.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                    <span className="text-sm">{t.name}</span>
                    {t.category && (
                      <span className="text-[10px] text-slate-400">· {t.category}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!email || password.length < 6 || create.isPending}
            style={{ backgroundColor: BRAND_RED }}
          >
            {create.isPending ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Reset Password Dialog ---------------- */

function ResetPasswordDialog({
  target,
  onClose,
  resetFn,
}: {
  target: { id: string; email: string } | null;
  onClose: () => void;
  resetFn: ReturnType<typeof useServerFn<typeof adminResetPassword>>;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (target) setPw(genPassword());
  }, [target?.id]);

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { userId: target!.id, password: pw } }),
    onSuccess: () => {
      toast.success("Password updated");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  useBackButtonClose(!!target, onClose);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Input
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button variant="outline" size="icon" onClick={() => setPw(genPassword())}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(pw);
              toast.success("Copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => reset.mutate()}
            disabled={pw.length < 6 || reset.isPending}
            style={{ backgroundColor: BRAND_RED }}
          >
            {reset.isPending ? "Saving…" : "Update password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Assign Templates Dialog ---------------- */

function AssignDialog({
  userId,
  users,
  templates,
  onClose,
}: {
  userId: string | null;
  users: Array<{ id: string; email: string; displayName: string | null; templateIds: string[] }>;
  templates: Array<{ id: string; name: string; category: string | null }>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const setFn = useServerFn(adminSetUserTemplates);
  const user = users.find((u) => u.id === userId) ?? null;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) setSelected(new Set(user.templateIds));
    else setSelected(new Set());
  }, [userId]);

  const save = useMutation({
    mutationFn: () => setFn({ data: { userId: userId!, templateIds: [...selected] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Templates updated");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  useBackButtonClose(!!userId, onClose);

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign templates</DialogTitle>
          {user && <DialogDescription>{user.displayName ?? user.email}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto space-y-1 border rounded p-2">
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No active templates.</p>
          ) : (
            templates.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
              >
                <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                <span className="text-sm">{t.name}</span>
                {t.category && <span className="text-[10px] text-slate-400">· {t.category}</span>}
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            style={{ backgroundColor: BRAND_RED }}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
