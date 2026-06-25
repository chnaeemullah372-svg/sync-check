import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    // During SSR there is no localStorage / browser session — always redirect
    // to /auth and let the client-side auth effect handle the actual navigation.
    if (typeof window === "undefined") throw redirect({ to: "/auth" });
    const localAdmin = getLocalAdminSession();
    if (localAdmin) {
      return { user: { id: "local-admin", email: localAdmin.email } };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
