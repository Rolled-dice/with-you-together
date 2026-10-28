import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { AppThemeSync } from "@/components/app-theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        {error instanceof Error && error.stack && (
          <pre className="mt-4 p-2 text-left text-xs bg-black/40 text-red-300 overflow-auto max-h-48 rounded">
            {error.stack}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SomeoneNear Checking in when they can't" },
      {
        name: "description",
        content:
          "Checking in when they can't. SomeoneNear is a warm family care membership with an AI Companion, human listener calls, mood insights, and a shared circle that keeps your loved ones close.",
      },
      { name: "author", content: "SomeoneNear" },
      { property: "og:title", content: "SomeoneNear Checking in when they can't" },
      {
        property: "og:description",
        content:
          "Checking in when they can't. SomeoneNear is a warm family care membership with an AI Companion, human listener calls, mood insights, and a shared circle that keeps your loved ones close.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SomeoneNear — Checking in when they can't" },
      {
        name: "twitter:description",
        content:
          "Checking in when they can't. SomeoneNear is a warm family care membership with an AI Companion, human listener calls, mood insights, and a shared circle that keeps your loved ones close.",
      },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
      // Square, padded, genuinely transparent icons built by
      // scripts/clean-logo.ps1 from the original artwork.
      { rel: "icon", href: "/favicon-64.png?v=6", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=6" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=Hanken+Grotesk:wght@400;500;600;700&display=swap",
      },
      {
        rel: "preconnect",
        href: "https://jflufaxdwzrohslviqeb.supabase.co",
        crossOrigin: "anonymous",
      },
      { rel: "dns-prefetch", href: "https://jflufaxdwzrohslviqeb.supabase.co" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Cookiebot hydration guard. Cookiebot's auto-blocking inserts a
          synchronous consent-config <script> right before the FIRST <script>
          in the document. React 19 only skips unexpected head <script>s during
          hydration when they are async, so that injected node collided with our
          inline scripts and the whole tree was thrown away and re-rendered
          ("Hydration failed").
          1. The empty async script is a React "resource": it's emitted in the
             head preamble and never hydrated in-tree, so it becomes the first
             <script> and the injected node lands next to it, harmlessly.
          2. The <noscript> is the first in-tree head child; hydrating it steps
             the cursor past the injected node before our real scripts.
        */}
        <script async src="/cb-anchor.js" />
        <noscript id="head-hydration-anchor" />
        <script
          id="app-theme"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('someonenear-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        <HeadContent />
        {/*
          Password-recovery links land on the Site URL root with the session
          in the URL (hash fragment or ?code=). Redirect to /auth/reset BEFORE
          any other script runs — including the Supabase client's own
          detectSessionInUrl — so there's no race between "consume the token"
          and "know this was a recovery link". Inert on every other page load.
        */}
        <script
          id="recovery-redirect"
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var p = window.location.pathname;
                var h = window.location.hash || "";
                var s = window.location.search || "";
                var isRecoveryUrl = /type=recovery/.test(h) || /type=recovery/.test(s) || (/access_token=/.test(h) && /recovery/i.test(h));
                if (isRecoveryUrl) {
                  // Leave a flag any page (including the authenticated gate)
                  // can check, in case the session already resolves before a
                  // hard redirect takes effect.
                  try { window.sessionStorage.setItem("sn_recovery_pending", "1"); } catch (e) {}
                }
                if (p.indexOf("/auth/reset") === 0) return;
                if (isRecoveryUrl) {
                  window.location.replace("/auth/reset" + s + h);
                }
              } catch (e) {}
            })();`,
          }}
        />
        <script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="3a9d7ca9-0293-48e0-8195-dda50a5cb1d6"
          data-blockingmode="auto"
          type="text/javascript"
        />
      </head>

      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // A password-recovery link can land on any page (Supabase redirects to the
    // Site URL root). It may arrive as a PASSWORD_RECOVERY event OR as a hash
    // fragment (#access_token=...&type=recovery / #type=recovery / #error=...).
    // Detect any of these on load and route to the set-new-password page.
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const onReset = window.location.pathname.startsWith("/auth/reset");
      const looksLikeRecovery =
        /type=recovery/.test(hash) || (/access_token=/.test(hash) && /recovery/.test(hash));
      if (looksLikeRecovery && !onReset) {
        // Preserve the hash so the reset page's client can establish the session.
        window.location.replace(`/auth/reset${window.location.hash}`);
      }
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/reset")) {
          window.location.replace(`/auth/reset${window.location.hash}`);
        }
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        void queryClient.cancelQueries().then(() => queryClient.clear());
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeSync />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster
        position="top-center"
        gap={12}
        duration={5000}
        toastOptions={{
          classNames: {
            toast:
              "rounded-3xl border border-border bg-surface text-foreground shadow-gentle font-sans",
            title: "font-display font-medium",
            description: "text-muted-foreground",
            actionButton: "rounded-full bg-primary text-primary-foreground",
            cancelButton: "rounded-full bg-muted text-muted-foreground",
          },
        }}
      />
    </QueryClientProvider>
  );
}
