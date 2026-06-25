---
name: SSR hydration fix for _authenticated route
description: How to avoid hydration errors from the _authenticated layout route in TanStack Start SSR
---

## Rule
Never put `ssr: false` on the `_authenticated` layout route. Use `typeof window === "undefined"` in `beforeLoad` instead.

## Why
`ssr: false` on a layout route causes TanStack Router to render a loading/empty shell on the server for ALL child routes. When the client hydrates, it renders actual content (or a redirect), creating a mismatch → React throws "Hydration failed" and "Invalid hook call" errors.

## How to apply
```ts
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // SSR always redirects to /auth; client handles real auth
    if (typeof window === "undefined") throw redirect({ to: "/auth" });
    const localAdmin = getLocalAdminSession();
    if (localAdmin) return { user: { id: "local-admin", email: localAdmin.email } };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
```

Server always renders `/auth` (clean, no mismatch). Client runs the real auth check and navigates accordingly.
