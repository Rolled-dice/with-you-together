import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import {
  SquaresFourIcon,
  ChatCircleIcon,
  UsersIcon,
  GearIcon,
  SignOutIcon,
  HandHeartIcon,
  LifebuoyIcon,
  ChartLineIcon,
  PhoneCallIcon,
  PillIcon,
  HeadphonesIcon,
  CalendarHeartIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SomeoneNearCursor } from "@/components/someonenear-cursor";
import { NotificationBell } from "@/components/notification-bell";
import { BrandMark } from "@/components/landing/brand-mark";
import { usePointerParallax } from "@/hooks/use-pointer-parallax";
import { useCardInteractions } from "@/hooks/use-card-interactions";
import { useAppPageMotion } from "@/hooks/use-app-page-motion";

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

// const ADMIN_NAV = [
//   { to: "/dashboard", label: "Dashboard", icon: SquaresFourIcon },
//   { to: "/admin/calls", label: "Call CRM", icon: PhoneCallIcon },
// ] as const;

const ADMIN_NAV = [{ to: "/admin/calls", label: "Call CRM", icon: PhoneCallIcon }] as const;

const AGENT_NAV = [{ to: "/agent/console", label: "Agent console", icon: HeadphonesIcon }] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mobileNavRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  usePointerParallax();
  useCardInteractions();

  // Drives the shared page entrance for every authenticated screen. Pages that
  // set no data-page-* attributes simply get nothing, so this is safe for
  // screens like the dashboard that run their own timeline.
  useAppPageMotion(mainRef);

  // Keep the active tab visible in the horizontally-scrollable mobile nav.
  useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  const { isAdmin, isAgent } = useRouteContext({ from: "/_authenticated" });
  const rolesLoading = false;

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
      <div className="mx-auto flex min-h-dvh w-full max-w-[1400px]">
        {/* Sidebar (desktop).
            Sized for older eyes and less precise pointing: 16px labels,
            48px-tall rows, 20px icons. The active row is a solid navy pill
            because a tinted background alone is easy to miss with reduced
            contrast sensitivity. */}
        <aside className="hidden flex-col border-r border-sidebar-border bg-sidebar md:flex md:w-72 lg:w-[19rem]">
          <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-5 py-5">
            <Brand />
            {!rolesLoading && !isStaff ? <NotificationBell /> : null}
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {navItems.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3.5 rounded-2xl px-4 text-[15px] transition-colors",
                    active
                      ? "bg-sidebar-primary font-bold text-sidebar-primary-foreground"
                      : "font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 pb-4">
            {!rolesLoading && !isStaff ? (
              <div className="rounded-2xl border border-sidebar-border bg-card px-4 py-3.5">
                <p className="text-sm font-bold text-sidebar-foreground">Care Membership</p>
                {/* The shell doesn't load the profile, so it can't name the tier
                 * without inventing one. Point at Settings instead. */}
                <Link
                  to="/settings"
                  className="mt-0.5 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View your plan
                </Link>
              </div>
            ) : null}
            <button
              onClick={signOut}
              className="mt-2 flex min-h-12 w-full items-center gap-3.5 rounded-2xl px-4 text-[15px] font-semibold text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <SignOutIcon className="h-5 w-5 shrink-0" /> Sign out
            </button>
          </div>
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

          {/* Keyed on pathname so the entrance replays on navigation. The ref
              lets useAppPageMotion scope itself to the current page's content,
              which is why any page using PageHeader animates with no extra
              wiring. */}
          <main
            key={pathname}
            ref={mainRef}
            className="flex-1 px-4 py-6 pb-[calc(6.25rem_+_env(safe-area-inset-bottom))] sm:px-8 sm:py-10 md:pb-10"
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
  // Shares the real mark and two-tone wordmark with the marketing site, so the
  // brand doesn't change the moment someone signs in. The old placeholder here
  // was a heart glyph in a filled square, which matched nothing.
  return (
    <Link to="/" className="flex items-center gap-2">
      <BrandMark className={compact ? "h-7 w-auto" : "h-9 w-auto"} />
      <span className={cn("font-extrabold tracking-tight", compact ? "text-base" : "text-lg")}>
        <span className="text-orb-navy">Someone</span>
        <span className="text-orb-terracotta">Near</span>
      </span>
    </Link>
  );
}

/**
 * Standard page header for authenticated screens.
 *
 * Emits the `data-page-*` attributes that `useAppPageMotion` (called by AppShell
 * below) animates, so every page that uses this gets the same entrance for free
 * rather than each one wiring its own.
 *
 * Type sizes are set for members who are often elderly: 28-35px title, 17px
 * description at full `muted-foreground` rather than 14px at reduced opacity,
 * which is a common readability failure with age.
 */
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p data-page-eyebrow className="text-sm font-bold text-orb-terracotta">
            {eyebrow}
          </p>
        )}
        <h1
          data-page-headline
          className="mt-1 text-[1.75rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2.2rem]"
        >
          {title}
        </h1>
        <div data-page-sub>
          {slogan && <p className="mt-1.5 text-base text-muted-foreground">{slogan}</p>}
          {description && (
            <p className="mt-2 max-w-2xl text-[1.0625rem] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && <div data-page-cta>{children}</div>}
    </div>
  );
}
