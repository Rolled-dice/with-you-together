import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Wordmark } from "@/components/landing/brand-mark";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";
import { Button } from "@/components/ui/button";
import { CalmSpace } from "@/components/calm/calm-space";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "A calm minute — breathe and let it go | SomeoneNear";
const DESCRIPTION =
  "Take a slow minute right now, no sign-up needed. Guided breathing and a gentle game to let a worry float away. From SomeoneNear.";

export const Route = createFileRoute("/calm")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://someonenear.com/calm" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/calm" }],
  }),
  component: PublicCalm,
});

function PublicCalm() {
  // A first-time visitor can use this with no account. If they happen to be
  // signed in, point the CTA at the app instead of the sign-up flow.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setSignedIn(Boolean(session));
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const cta: "/dashboard" | "/auth" = signedIn ? "/dashboard" : "/auth";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Landing-style nav so the space feels part of the same site. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <nav className="mx-auto flex h-[4.5rem] w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link to="/" aria-label="SomeoneNear home">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            {!signedIn && (
              <Button asChild variant="ghost" className="hidden rounded-full font-semibold sm:inline-flex">
                <Link to="/auth">Log in</Link>
              </Button>
            )}
            <Button asChild className="rounded-full px-5 font-bold">
              <Link to={cta}>{signedIn ? "Open app" : "Try for free"}</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-6 text-center sm:mb-8">
          <p className="text-sm font-bold text-orb-terracotta">A quiet moment</p>
          <h1 className="mt-1 text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
            Take a slow minute
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground">
            Nothing to sign up for, nothing to finish. Breathe, or let a worry float away. Stay as
            long as you like.
          </p>
        </div>

        <CalmSpace />

        {/* Gentle invitation, never a wall. */}
        <section className="mt-10 rounded-[28px] bg-surface px-6 py-8 text-center sm:px-9">
          <h2 className="mx-auto max-w-md text-xl font-extrabold tracking-tight sm:text-2xl">
            When you want more than a minute
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[0.975rem] leading-relaxed text-muted-foreground">
            SomeoneNear pairs this calm space with real listeners you can talk to, a warm AI
            companion, and gentle check-ins for the people you love.
          </p>
          <div className="mt-5">
            <Button asChild size="lg" data-magnetic className="rounded-full px-8 text-base font-bold">
              <Link to={cta}>
                {signedIn ? "Open SomeoneNear" : "Explore SomeoneNear"}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {!signedIn && (
              <p className="mt-3 text-xs font-semibold text-muted-foreground">No card needed</p>
            )}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <Link to="/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link to="/cookies" className="hover:text-primary">
            Cookies
          </Link>
          <PrivacyChoicesButton className="h-auto p-0 text-xs font-normal" />
        </div>
      </main>
    </div>
  );
}
