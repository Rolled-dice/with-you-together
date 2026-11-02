import { useState, type ReactNode } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ListIcon, ArrowLeftIcon, ArrowRightIcon, CaretRightIcon } from "@phosphor-icons/react";
import { BrandMark } from "@/components/landing/brand-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type DocLink = { to: string; label: string };
export type DocGroup = { title: string; links: DocLink[] };

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Start here",
    links: [
      { to: "/docs", label: "Welcome" },
      { to: "/docs/getting-started", label: "Getting started" },
    ],
  },
  {
    title: "Features",
    links: [
      { to: "/docs/check-in", label: "Check-In" },
      { to: "/docs/companion", label: "Companion" },
      { to: "/docs/family", label: "Family Circle" },
      { to: "/docs/insights", label: "Insights" },
      { to: "/docs/medication", label: "Medication" },
      { to: "/docs/send-later", label: "Send Later" },
      { to: "/docs/safety", label: "Safety" },
    ],
  },
  {
    title: "Account & Billing",
    links: [
      { to: "/docs/billing", label: "Billing & plans" },
      { to: "/docs/account", label: "Your account" },
    ],
  },
  {
    title: "Help",
    links: [{ to: "/docs/faq", label: "FAQ" }],
  },
];

const FLAT: DocLink[] = DOC_GROUPS.flatMap((g) => g.links);

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="flex flex-col gap-6 py-2">
      {DOC_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {g.title}
          </div>
          <ul className="space-y-1">
            {g.links.map((l) => {
              const active = pathname === l.to;
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-primary/10 font-bold text-primary"
                        : "font-medium text-foreground/75 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsShell() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const idx = FLAT.findIndex((l) => l.to === pathname);
  const prev = idx > 0 ? FLAT[idx - 1] : null;
  const next = idx >= 0 && idx < FLAT.length - 1 ? FLAT[idx + 1] : null;
  const current = FLAT[idx];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open docs menu"
                >
                  <ListIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto p-4">
                <SheetTitle className="px-3 pb-2 text-base">Docs</SheetTitle>
                <SidebarNav onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2">
              <BrandMark className="h-7 w-auto" />
              <span className="text-base font-extrabold tracking-tight">
                <span className="text-orb-navy">Someone</span>
                <span className="text-orb-terracotta">Near</span>
                <span className="ml-1.5 font-semibold text-muted-foreground">Docs</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-full font-semibold sm:inline-flex"
            >
              <Link to="/">Back to site</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full font-bold">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 sm:px-6">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto py-8 lg:block">
          <SidebarNav />
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 py-8">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/docs" className="hover:text-foreground">
              Docs
            </Link>
            {current && current.to !== "/docs" && (
              <>
                <CaretRightIcon className="h-3 w-3" />
                <span className="text-foreground">{current.label}</span>
              </>
            )}
          </div>

          <article className="prose-none max-w-3xl">
            <Outlet />
          </article>

          {/* Prev / Next */}
          {(prev || next) && (
            <nav className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
              {prev ? (
                <Link
                  to={prev.to}
                  className="group rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowLeftIcon className="h-3 w-3" /> Previous
                  </div>
                  <div className="mt-1 font-bold group-hover:text-primary">{prev.label}</div>
                </Link>
              ) : (
                <div />
              )}
              {next ? (
                <Link
                  to={next.to}
                  className="group rounded-2xl border border-border p-4 text-right transition hover:border-primary/40 hover:bg-primary/5 sm:text-right"
                >
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    Next <ArrowRightIcon className="h-3 w-3" />
                  </div>
                  <div className="mt-1 font-bold group-hover:text-primary">{next.label}</div>
                </Link>
              ) : (
                <div />
              )}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------- Building blocks -------------------- */

export function DocHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {eyebrow && <div className="mb-2 text-sm font-bold text-orb-terracotta">{eyebrow}</div>}
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      {intro && (
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted-foreground sm:text-lg">
          {intro}
        </p>
      )}
    </header>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[1.0625rem] leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

export function Steps({ items }: { items: { title: string; body?: ReactNode }[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {items.map((s, i) => (
        <li key={i} className="flex gap-4 rounded-2xl border border-border p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {i + 1}
          </span>
          <div>
            <div className="font-bold">{s.title}</div>
            {s.body && <div className="mt-1 text-[15px] text-muted-foreground">{s.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "tip" | "warn";
  title?: string;
  children: ReactNode;
}) {
  // Tones drawn from the orb family so callouts belong to the Playroom palette
  // rather than stock Tailwind sky/emerald/amber.
  const toneStyles: Record<string, string> = {
    info: "border-orb-periwinkle/40 bg-orb-periwinkle/10",
    tip: "border-orb-grass/35 bg-orb-grass/10",
    warn: "border-orb-terracotta/35 bg-orb-terracotta/10",
  };
  return (
    <div className={cn("mt-4 rounded-2xl border p-4 text-[15px]", toneStyles[tone])}>
      {title && <div className="mb-1 font-bold">{title}</div>}
      <div className="text-foreground/85">{children}</div>
    </div>
  );
}

export function MiniFaq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="mt-4 divide-y rounded-2xl border">
      {items.map((it, i) => (
        <details key={i} className="group p-4">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="inline-flex items-center gap-2">
              <CaretRightIcon className="h-4 w-4 transition group-open:rotate-90" />
              {it.q}
            </span>
          </summary>
          <div className="mt-2 pl-6 text-sm text-muted-foreground">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

export function TryItNow({ to, label }: { to: string; label: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="text-[15px] font-bold">Ready to try it?</div>
      <Button asChild size="sm" className="rounded-full font-bold">
        <Link to={to}>{label}</Link>
      </Button>
    </div>
  );
}
