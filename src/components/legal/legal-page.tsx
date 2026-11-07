import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/landing/brand-mark";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";

export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="sn-legal-page min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="SomeoneNear home">
            <Wordmark />
          </Link>
          <Link to="/auth" className="text-sm font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <nav className="sn-legal-navigation" aria-label="Privacy and legal">
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/cookies">Cookie policy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{summary}</p>
        <p className="mt-3 text-sm text-muted-foreground">Effective 25 September 2026</p>
        <article className="legal-copy mt-10">{children}</article>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-6 text-sm sm:px-8">
          <Link to="/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link to="/cookies" className="hover:text-primary">
            Cookies
          </Link>
          <PrivacyChoicesButton className="h-auto p-0 text-sm" />
          <span className="ml-auto text-muted-foreground">© 2026 SomeoneNear</span>
        </div>
      </footer>
    </div>
  );
}
