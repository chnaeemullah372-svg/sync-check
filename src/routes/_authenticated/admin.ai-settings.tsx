import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, XCircle, Save, Loader2, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAiContext,
  setAiSettings,
  listAiUsage,
  listUserAiAccess,
  setUserAiAccess,
  listProviderKeys,
  setProviderKey,
} from "@/lib/api/ai.functions";
import { adminListUsers } from "@/lib/api/admin.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/ai-settings")({
  head: () => ({ meta: [{ title: "AI Settings" }] }),
  component: AiSettingsPage,
});

function AiSettingsPage() {
  const { role, loading, user } = useAuth();
  const ctxFn = useServerFn(getAiContext);
  const saveFn = useServerFn(setAiSettings);
  const usageFn = useServerFn(listAiUsage);
  const usersFn = useServerFn(adminListUsers);
  const accessFn = useServerFn(listUserAiAccess);
  const setAccessFn = useServerFn(setUserAiAccess);
  const keysFn = useServerFn(listProviderKeys);
  const saveKeyFn = useServerFn(setProviderKey);
  const qc = useQueryClient();

  const isAdmin = !!user && role === "admin";
  const { data: ctx } = useQuery({ queryKey: ["ai-context"], queryFn: () => ctxFn(), enabled: isAdmin });
  const { data: usage } = useQuery({ queryKey: ["ai-usage"], queryFn: () => usageFn(), enabled: isAdmin });
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn(), enabled: isAdmin });
  const { data: accessMap } = useQuery({ queryKey: ["ai-access"], queryFn: () => accessFn(), enabled: isAdmin });
  const { data: providerKeys } = useQuery({ queryKey: ["provider-keys"], queryFn: () => keysFn(), enabled: isAdmin });

  const saveKey = useMutation({
    mutationFn: (v: { provider: "openai" | "gemini" | "claude"; apiKey: string }) =>
      saveKeyFn({ data: v }),
    onSuccess: (r) => {
      toast.success(r.cleared ? "Key removed" : "Key saved");
      qc.invalidateQueries({ queryKey: ["provider-keys"] });
      qc.invalidateQueries({ queryKey: ["ai-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [mode, setMode] = useState<"disabled" | "standard" | "advanced">("standard");
  const [provider, setProvider] = useState<"openai" | "gemini" | "claude" | "">("");

  useEffect(() => {
    if (ctx) {
      setMode(ctx.mode);
      setProvider((ctx.provider ?? "") as any);
    }
  }, [ctx]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { mode, provider: (provider || null) as any } }),
    onSuccess: (r) => {
      toast.success(r.providerConfigured || mode !== "advanced" ? "Saved" : "Saved — but provider key not configured");
      qc.invalidateQueries({ queryKey: ["ai-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setUserAccess = useMutation({
    mutationFn: (v: { userId: string; access: "disabled" | "standard" | "advanced" | "both" }) =>
      setAccessFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["ai-access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role && role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-xl font-bold">Admin access only</h1>
      </div>
    );
  }

  const advancedConfigured = ctx?.advancedConfigured ?? false;
  const totalCost = (usage ?? []).reduce((s, r: any) => s + Number(r.estimated_cost || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link to="/card/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">AI Settings</h1>
          <p className="text-sm text-slate-500">Configure global extraction mode and per-user access. API keys are stored as server-side secrets only.</p>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Global</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-bold">Extraction Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-slate-500">When disabled, manual data entry continues to work.</p>
            </div>
            {mode === "advanced" && (
              <div>
                <Label className="text-xs font-bold">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {advancedConfigured ? (
                    <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> <span className="text-emerald-700">Connected</span></>
                  ) : (
                    <><XCircle className="h-4 w-4 text-rose-600" /> <span className="text-rose-700">Not Connected — API key missing</span></>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Add the provider API key below in <strong>Provider API Keys</strong>.
                </p>
              </div>
            )}
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </Card>

        <ProviderKeysCard
          providerKeys={providerKeys}
          onSave={(provider, apiKey) => saveKey.mutate({ provider, apiKey })}
          saving={saveKey.isPending}
        />

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Per-User Access</h2>
          <div className="overflow-hidden rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs">
                <tr><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Access</th></tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => {
                  const a = (accessMap?.[u.id] ?? "standard") as "disabled" | "standard" | "advanced" | "both";
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="px-3 py-2">{u.displayName || u.email}</td>
                      <td className="px-3 py-2 text-slate-500">{u.email}</td>
                      <td className="px-3 py-2">
                        <Select value={a} onValueChange={(v) => setUserAccess.mutate({ userId: u.id, access: v as any })}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disabled">Disabled</SelectItem>
                            <SelectItem value="standard">Standard only</SelectItem>
                            <SelectItem value="advanced">Advanced only</SelectItem>
                            <SelectItem value="both">Standard + Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Usage Logs</h2>
            <p className="text-xs text-slate-500">Estimated cost (200 latest): <strong>${totalCost.toFixed(4)}</strong></p>
          </div>
          <div className="max-h-80 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr><th className="px-2 py-1 text-left">When</th><th className="px-2 py-1 text-left">User</th><th className="px-2 py-1 text-left">Mode</th><th className="px-2 py-1 text-left">Provider</th><th className="px-2 py-1 text-left">Input</th><th className="px-2 py-1 text-right">Tokens</th><th className="px-2 py-1 text-right">Cost</th></tr>
              </thead>
              <tbody>
                {(usage ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-2 py-1 text-slate-500">{r.user_id.slice(0, 8)}</td>
                    <td className="px-2 py-1">{r.mode}</td>
                    <td className="px-2 py-1">{r.provider}</td>
                    <td className="px-2 py-1">{r.input_type}</td>
                    <td className="px-2 py-1 text-right">{r.estimated_tokens}</td>
                    <td className="px-2 py-1 text-right">${Number(r.estimated_cost).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

type ProviderId = "openai" | "gemini" | "claude";
const PROVIDERS: { id: ProviderId; label: string; placeholder: string; hint: string }[] = [
  { id: "openai", label: "OpenAI", placeholder: "sk-...", hint: "Get key from platform.openai.com → API Keys" },
  { id: "gemini", label: "Gemini (Google)", placeholder: "AIza...", hint: "Get key from aistudio.google.com → Get API Key" },
  { id: "claude", label: "Claude (Anthropic)", placeholder: "sk-ant-...", hint: "Get key from console.anthropic.com → API Keys" },
];

function ProviderKeysCard({
  providerKeys,
  onSave,
  saving,
}: {
  providerKeys?: Record<string, { configured: boolean; updatedAt?: string }>;
  onSave: (provider: ProviderId, apiKey: string) => void;
  saving: boolean;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Provider API Keys</h2>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Keys are stored encrypted server-side. They are never shown back in the UI — only a status indicator.
      </p>
      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <ProviderKeyRow
            key={p.id}
            provider={p}
            status={providerKeys?.[p.id]}
            onSave={(val) => onSave(p.id, val)}
            saving={saving}
          />
        ))}
      </div>
    </Card>
  );
}

function ProviderKeyRow({
  provider,
  status,
  onSave,
  saving,
}: {
  provider: { id: ProviderId; label: string; placeholder: string; hint: string };
  status?: { configured: boolean; updatedAt?: string };
  onSave: (apiKey: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const configured = !!status?.configured;

  return (
    <div className="rounded border p-3 space-y-2 bg-slate-50/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{provider.label}</span>
          {configured ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <XCircle className="h-3.5 w-3.5" /> Not set
            </span>
          )}
        </div>
        {configured && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-rose-600 hover:text-rose-700"
            onClick={() => {
              if (confirm(`Remove ${provider.label} API key?`)) onSave("");
            }}
            disabled={saving}
          >
            <Trash2 className="h-3 w-3" /> Remove
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={configured ? "Enter new key to replace…" : provider.placeholder}
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!value.trim()) {
              toast.error("Enter a key first");
              return;
            }
            onSave(value);
            setValue("");
          }}
          disabled={saving || !value.trim()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </Button>
      </div>
      <p className="text-[10px] text-slate-500">{provider.hint}</p>
    </div>
  );
}
