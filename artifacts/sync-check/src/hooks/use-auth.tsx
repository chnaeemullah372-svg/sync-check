import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

type Role = "admin" | "user" | null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_ADMIN_KEY = "local_admin_session";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getLocalAdminSession() {
  if (typeof localStorage === "undefined") return null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [localAdminUser, setLocalAdminUser] = useState<User | null>(null);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const localAdmin = getLocalAdminSession();
    if (localAdmin) {
      setRole("admin");
      setLocalAdminUser({ id: "local-admin", email: localAdmin.email } as User);
      setLoading(false);
      return;
    }

    const fetchRole = async (uid: string, email?: string) => {
      // Admin email shortcut — no DB query needed
      if (email?.endsWith("@admin.local")) {
        setRole("admin");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const roles = (data ?? []).map((r) => r.role as string);
      setRole(roles.includes("admin") ? "admin" : "user");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      const isSignOut = event === "SIGNED_OUT";
      if (s?.user && !isSignOut) {
        setTimeout(() => { fetchRole(s.user.id, s.user.email); }, 0);
      } else {
        setRole(null);
      }
      if (event === "SIGNED_IN" || isSignOut || event === "USER_UPDATED") {
        router.invalidate();
        if (!isSignOut) qc.invalidateQueries();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchRole(data.session.user.id, data.session.user.email).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, qc]);

  const signOut = async () => {
    localStorage.removeItem(LOCAL_ADMIN_KEY);
    setLocalAdminUser(null);
    setRole(null);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const user = localAdminUser ?? session?.user ?? null;

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
