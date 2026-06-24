import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { localAdminSignIn } from "@/lib/api/local-admin-auth.functions";

const LOCAL_ADMIN_KEY = "local_admin_session";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getLocalAdminSession() {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email: string; role: string; ts: number };
    if (Date.now() - parsed.ts > MAX_AGE_MS) {
      localStorage.removeItem(LOCAL_ADMIN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HASAN ALI Professional" },
      { name: "description", content: "Secure login to HASAN ALI Professional document system." },
    ],
  }),
  component: AuthPage,
});

function toEmail(input: string) {
  const v = input.trim();
  if (v.includes("@")) return v.toLowerCase();
  return `${v.toLowerCase()}@admin.local`;
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    const localAdmin = getLocalAdminSession();
    if (localAdmin) {
      navigate({ to: "/card/admin", replace: true });
      return;
    }
    if (user && role) {
      navigate({ to: role === "admin" ? "/card/admin" : "/user", replace: true });
    }
  }, [user, role, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const isAdminUsername = username.trim().toLowerCase() === "naeem";
    if (isAdminUsername) {
      try {
        const result = await localAdminSignIn({ data: { username: username.trim(), password } });
        if (result.ok) {
          localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify({
            email: "naeem@admin.local",
            role: "admin",
            ts: Date.now(),
          }));
          setBusy(false);
          toast.success("Signed in");
          navigate({ to: "/card/admin", replace: true });
          return;
        }
      } catch {
        // fall through to Supabase if server fn fails
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    });
    setBusy(false);
    if (error) toast.error("Invalid username or password");
    else toast.success("Signed in");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4 font-mono text-emerald-400">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.12),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(16,185,129,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,.6) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="pointer-events-none absolute left-4 top-4 hidden text-[10px] text-emerald-500/70 sm:block">
        <p>$ ssh root@hasanali.sys</p>
        <p>$ initiating handshake...</p>
        <p className="text-emerald-400">$ awaiting credentials_</p>
      </div>
      <Card className="relative w-full max-w-md border border-emerald-500/30 bg-black/80 p-8 shadow-[0_0_60px_-15px_rgba(16,185,129,0.5)] backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-400/40 bg-black shadow-[inset_0_0_30px_rgba(16,185,129,0.3)]">
          <svg viewBox="0 0 64 64" className="h-12 w-12 text-emerald-400" fill="currentColor">
            <path d="M32 6C18 6 12 18 12 30c0 10 4 18 10 22 2 1 4 2 6 2h8c2 0 4-1 6-2 6-4 10-12 10-22 0-12-6-24-20-24Zm-9 24c-3 0-5-2-5-5s2-5 5-5h5c3 0 5 2 5 5s-2 5-5 5h-5Zm18 0c-3 0-5-2-5-5s2-5 5-5h0c3 0 5 2 5 5s-2 5-5 5Zm-9 18c-4 0-7-2-9-5h18c-2 3-5 5-9 5Z" />
            <rect x="16" y="26" width="14" height="3" fill="black" />
            <rect x="34" y="26" width="14" height="3" fill="black" />
          </svg>
        </div>
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">// HACKER · ANONYMOUS ACCESS</p>
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-emerald-300">HASAN ALI</h1>
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500/80">&lt;underground/&gt;</p>
        <p className="mb-6 text-center text-sm text-emerald-500/60">root@system ~ # authenticate</p>
        <form onSubmit={signIn} className="space-y-4">
          <div>
            <Label htmlFor="u" className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">&gt; username</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" className="mt-1 border-emerald-500/30 bg-black/60 font-mono text-emerald-300 placeholder:text-emerald-700 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30" />
          </div>
          <div>
            <Label htmlFor="p" className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">&gt; password</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="mt-1 border-emerald-500/30 bg-black/60 font-mono text-emerald-300 placeholder:text-emerald-700 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30" />
          </div>
          <Button type="submit" disabled={busy} className="w-full border border-emerald-400/50 bg-emerald-500/10 font-bold text-emerald-300 shadow-[0_0_20px_-5px_rgba(16,185,129,0.6)] hover:bg-emerald-500/20 hover:text-emerald-200">
            {busy ? "[ decrypting... ]" : "[ EXECUTE LOGIN ]"}
          </Button>
        </form>
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-emerald-700">// HASAN ALI · ENCRYPTED · 256-BIT</p>
      </Card>
    </div>
  );
}
