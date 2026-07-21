import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Heart, LayoutDashboard, MessageCircleHeart, BookHeart, Users, Settings, LogOut, HeartHandshake, LifeBuoy, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { WithUCursor } from "@/components/withu-cursor";
import { usePointerParallax } from "@/hooks/use-pointer-parallax";
import { useCardInteractions } from "@/hooks/use-card-interactions";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companion", label: "Companion", icon: MessageCircleHeart },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/insights", label: "Insights", icon: LineChart },
  { to: "/listeners", label: "Listeners", icon: Users },
  { to: "/family", label: "Family", icon: HeartHandshake },
  { to: "/safety", label: "Safety", icon: LifeBuoy },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  usePointerParallax();
  useCardInteractions();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }


  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <WithUCursor />
      <div className="mx-auto flex min-h-dvh w-full max-w-[1400px]">

        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6">
          <Brand />
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-brand px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-brand bg-sidebar-accent/60 p-4 text-xs text-sidebar-accent-foreground/80">
            <p className="font-medium text-sidebar-foreground">Care Membership</p>
            <p className="mt-1">You're on the Together tier.</p>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 rounded-brand px-4 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </aside>


        {/* Main */}
        <div className="flex flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
            <Brand compact />
          </header>

          <main
            key={pathname}
            className="flex-1 animate-fade-in px-4 py-6 pb-[calc(6.25rem_+_env(safe-area-inset-bottom))] sm:px-8 sm:py-10 md:pb-10"
          >
            {children}
          </main>

          {/* Mobile bottom nav */}
          <nav
            className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-8 overflow-hidden border-t border-border bg-sidebar/95 backdrop-blur md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {NAV.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors sm:text-[11px]",
                    active ? "text-brand-accent" : "text-sidebar-foreground/70",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  <span className="block max-w-full truncate leading-none">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-brand bg-brand-primary text-primary-foreground shadow-sm">
        <Heart className="h-5 w-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-lg font-semibold tracking-tight text-foreground">WithU</span>
      )}
      {compact && (
        <span className="text-lg font-semibold tracking-tight text-foreground">WithU</span>
      )}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  slogan,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  slogan?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-slide-in-up">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-accent">
            {eyebrow}
          </p>
        )}
        {slogan && (
          <p className="mt-1 text-[13px] font-medium italic text-brand-accent/80">
            {slogan}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

