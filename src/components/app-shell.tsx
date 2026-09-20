import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { HeartIcon, SquaresFourIcon, ChatCircleIcon, UsersIcon, GearIcon, SignOutIcon, HandHeartIcon, LifebuoyIcon, ChartLineIcon, PhoneCallIcon, PillIcon, HeadphonesIcon, CalendarHeartIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/lib/feedback-admin.functions";
import { isCurrentUserAgent } from "@/lib/agent-role.functions";
import { SomeoneNearCursor } from "@/components/someonenear-cursor";
import { NotificationBell } from "@/components/notification-bell";
import { DevViewAsSwitcher } from "@/components/dev-view-as-switcher";
import { usePointerParallax } from "@/hooks/use-pointer-parallax";
import { useCardInteractions } from "@/hooks/use-card-interactions";
import { getViewAsRole } from "@/lib/dev-view-as";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: SquaresFourIcon },
  { to: "/companion", label: "Companion", icon: ChatCircleIcon },
  { to: "/listeners", label: "Listeners", icon: UsersIcon },
  { to: "/reminders", label: "Medication", icon: PillIcon },
  { to: "/send-later", label: "Send Later", icon: CalendarHeartIcon },
  { to: "/insights", label: "Insights", icon: ChartLineIcon },
  { to: "/family", label: "Family", icon: HandHeartIcon },
  { to: "/safety", label: "Safety", icon: LifebuoyIcon },
  { to: "/settings", label: "Settings", icon: GearIcon },
] as const;

const ADMIN_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: SquaresFourIcon },
  { to: "/admin/calls", label: "Call CRM", icon: PhoneCallIcon },
] as const;

const AGENT_NAV = [
  { to: "/agent/console", label: "Agent console", icon: HeadphonesIcon },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mobileNavRef = useRef<HTMLElement>(null);
  usePointerParallax();
  useCardInteractions();

  // Keep the active tab visible in the horizontally-scrollable mobile nav.
  useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  const adminCheck = useServerFn(isCurrentUserAdmin);
  const roleQ = useQuery({
    queryKey: ["admin", "role-check"],
    queryFn: () => adminCheck({}),
    staleTime: 5 * 60 * 1000,
  });
  const agentCheck = useServerFn(isCurrentUserAgent);
  const agentQ = useQuery({
    queryKey: ["agent", "role-check"],
    queryFn: () => agentCheck({}),
    staleTime: 5 * 60 * 1000,
  });
  // Dev-only render override — see src/lib/dev-view-as.ts. It changes what
  // this component chooses to display, never what the real RPCs return, so
  // it cannot unlock a page or a row the signed-in account doesn't already
  // have. Real role gating (_authenticated/route.tsx, every server fn) is
  // completely unaffected and keeps checking has_role / is_call_agent as
  // normal — the CRM and softphone routes still enforce those for real, this
  // toggle just gets the SHELL to look the same way while you're on member
  // data underneath.
  const viewAs = getViewAsRole();
  const isAdmin = viewAs ? viewAs === "admin" : roleQ.data?.isAdmin === true;
  const isAgent = viewAs ? viewAs === "listener" : agentQ.data?.isAgent === true;
  const rolesLoading = viewAs ? false : roleQ.isLoading || agentQ.isLoading;
  const isStaff = isAdmin || isAgent;
  const navItems = isAdmin ? ADMIN_NAV : isAgent ? AGENT_NAV : rolesLoading ? [] : NAV;


  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }



  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <SomeoneNearCursor />
      <DevViewAsSwitcher />
      <div className="mx-auto flex min-h-dvh w-full max-w-[1400px]">

        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6">
          <div className="flex items-center justify-between">
            <Brand />
            {!rolesLoading && !isStaff ? <NotificationBell /> : null}
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
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
          {!rolesLoading && !isStaff ? (
            <div className="mt-6 rounded-brand bg-sidebar-accent/60 p-4 text-xs text-sidebar-accent-foreground/80">
              <p className="font-medium text-sidebar-foreground">Care Membership</p>
              {/* The shell doesn't load the profile, so it can't name the tier
               * without inventing one. Point at Settings instead. */}
              <Link to="/settings" className="mt-1 block underline underline-offset-2">
                View your plan
              </Link>
            </div>
          ) : null}
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 rounded-brand px-4 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <SignOutIcon className="h-4 w-4" /> Sign out
          </button>
        </aside>


        {/* Main */}
        <div className="flex flex-1 flex-col">
          {/* Mobile top bar */}
          <header
            className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
          >
            <Brand compact />
            {!rolesLoading && !isStaff ? <NotificationBell /> : null}
          </header>


          <main
            key={pathname}
            className="flex-1 animate-fade-in px-4 py-6 pb-[calc(6.25rem_+_env(safe-area-inset-bottom))] sm:px-8 sm:py-10 md:pb-10"
          >
            {children}
          </main>

          {/* Mobile bottom nav */}
          <nav
            ref={mobileNavRef}
            className="fixed inset-x-0 bottom-0 z-50 flex overflow-x-auto overscroll-x-contain border-t border-border bg-sidebar/95 backdrop-blur [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            aria-label="Main navigation"
          >

            {navItems.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-active={active ? "true" : undefined}
                  className={cn(
                    "flex min-h-16 min-w-20 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors active:bg-sidebar-accent/60",
                    active ? "text-brand-accent" : "text-sidebar-foreground/70",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  <span className="block max-w-full whitespace-nowrap leading-none">{item.label}</span>
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
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-brand bg-primary text-primary-foreground">
        <HeartIcon className="h-5 w-5" weight="fill" />
      </span>
      <span className="font-sans text-lg font-semibold tracking-tight text-foreground">
        SomeoneNear
      </span>
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
          <p className="text-sm font-medium text-brand-accent">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {slogan && (
          <p className="mt-1 text-sm text-muted-foreground">{slogan}</p>
        )}
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

