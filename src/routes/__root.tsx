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
import { PrivacyPreferences } from "@/components/privacy-preferences";
import { WebsiteFeedback } from "@/components/website-feedback";
import prototypeCss from "../prototype.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SessionLifecycle } from "@/features/session/session-boundary";
import { OrganizationSchema } from "@/components/organization-schema";
import { Toaster } from "sonner";

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
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error instanceof Error ? error : new Error(String(error || "A page failed to render")), {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong on our end. You can try refreshing or head back home.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
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
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Reload page
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
      { title: "SomeoneNear — Warm Family Care, Reminders & AI Companion" },
      {
        name: "description",
        content:
          "Stay close across any distance. SomeoneNear provides gentle phone check-in listeners, daily medication reminders, mood insights, and an empathetic AI Companion for elderly family care.",
      },
      { name: "author", content: "SomeoneNear" },
      { property: "og:site_name", content: "SomeoneNear" },
      { property: "og:title", content: "SomeoneNear — Warm Family Care, Reminders & AI Companion" },
      {
        property: "og:description",
        content:
          "Stay close across any distance. SomeoneNear provides gentle phone check-in listeners, daily medication reminders, mood insights, and an empathetic AI Companion for elderly family care.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://someonenear.com/" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SomeoneNear — Warm Family Care, Reminders & AI Companion" },
      {
        name: "twitter:description",
        content:
          "Stay close across any distance. SomeoneNear provides gentle phone check-in listeners, daily medication reminders, mood insights, and an empathetic AI Companion for elderly family care.",
      },
      { name: "twitter:image", content: "https://someonenear.com/logo.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: prototypeCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Brand squircle icons
      { rel: "icon", href: "/favicon.svg?v=15", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png?v=15", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon-64.png?v=15", sizes: "64x64", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=15", sizes: "180x180" },
      { rel: "shortcut icon", href: "/favicon.ico?v=15" },
      { rel: "icon", href: "/favicon.ico?v=15", sizes: "any" },
      {
        rel: "preload",
        href: "/fonts/figtree.ttf",
        as: "font",
        type: "font/ttf",
        crossOrigin: "anonymous",
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
    <html lang="en">
      <head>
        <HeadContent />
        <OrganizationSchema />
      </head>

      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionLifecycle />
      <WebsiteFeedback />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PrivacyPreferences />
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
