import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronDown, FileClock, Files, History, Home, Info, KeyRound, LifeBuoy, LogOut, Mail, Shield, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { label: "Dashboard", to: "/user", icon: Home },
  { label: "My Templates", to: "/user", icon: Files },
  { label: "My Entries", to: "/user/history", icon: FileClock },
  { label: "History", to: "/user/history", icon: History },
] as const;

export function UserShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-user-page text-user-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-user-sidebar text-user-sidebar-foreground shadow-2xl lg:flex">
        <div className="flex h-24 items-center gap-3 px-6">
          <BrandMark />
          <div className="min-w-0">
            <p className="text-lg font-black leading-none tracking-wide">HASAN ALI</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-user-sidebar-muted">Professional System</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || (item.label === "My Templates" && pathname.startsWith("/user/templates"));
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                  active ? "bg-user-sidebar-active text-user-sidebar-foreground" : "text-user-sidebar-soft hover:bg-user-sidebar-hover hover:text-user-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <Button onClick={signOut} variant="outline" className="w-full border-user-sidebar-border bg-transparent text-user-sidebar-foreground hover:bg-user-sidebar-hover">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-user-border bg-user-surface/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <BrandMark compact />
              <span className="text-sm font-black tracking-wide">HASAN ALI</span>
            </div>
            <p className="hidden text-sm font-bold text-user-muted lg:block">{title ?? "Document Workspace"}</p>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-user-border bg-user-page px-2 py-1 transition hover:border-user-brand hover:bg-user-brand-soft"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-user-sidebar text-[11px] font-black text-user-sidebar-foreground">
                      {initials}
                    </div>
                    <span className="hidden max-w-32 truncate text-xs font-bold sm:inline">{displayName}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-user-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-user-sidebar text-xs font-black text-user-sidebar-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-user-ink">{displayName}</p>
                      <p className="truncate text-[11px] font-normal text-user-muted">{email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/user" className="cursor-pointer">
                      <UserCircle className="mr-2 h-4 w-4" /> My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/user/history" className="cursor-pointer">
                      <History className="mr-2 h-4 w-4" /> History
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => alert("Password change coming soon.")}>
                    <KeyRound className="mr-2 h-4 w-4" /> Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => window.open("https://hasanali.com", "_blank")}>
                    <Info className="mr-2 h-4 w-4" /> About
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open("mailto:support@hasanali.com", "_blank")}>
                    <Mail className="mr-2 h-4 w-4" /> Contact Support
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open("https://hasanali.com/privacy", "_blank")}>
                    <Shield className="mr-2 h-4 w-4" /> Privacy & Terms
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => alert("Need help? Email support@hasanali.com")}>
                    <LifeBuoy className="mr-2 h-4 w-4" /> Help
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => signOut()}
                    className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${compact ? "h-10 w-10" : "h-12 w-12"} flex shrink-0 items-center justify-center rounded-full border-2 border-user-brand bg-user-brand-soft text-user-brand shadow-sm`}>
      <span className="text-sm font-black leading-none">HA</span>
    </div>
  );
}
