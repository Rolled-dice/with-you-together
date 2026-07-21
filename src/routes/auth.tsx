import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Heart, Loader2, AlertCircle, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldRow } from "@/components/auth/field-row";
import { classifyAuthError } from "@/lib/auth-errors";
import { safeAuthRedirect } from "@/lib/auth-routing";

const SignUpForm = lazy(() =>
  import("@/components/auth/sign-up-form").then((m) => ({ default: m.SignUpForm })),
);

type AuthSearch = { reason?: "session_expired" | "signed_out"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    reason:
      search.reason === "session_expired" || search.reason === "signed_out"
        ? search.reason
        : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — WithU" },
      { name: "description", content: "Sign in or create your WithU account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const redirectTo = safeAuthRedirect(search.redirect);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [checkingSession, setCheckingSession] = useState(true);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (search.reason === "session_expired") {
      toast.error("Your session expired", {
        description: "Please sign in again to continue.",
      });
    }
  }, [search.reason]);

  useEffect(() => {
    let cancelled = false;
    const fallback = window.setTimeout(() => {
      if (!cancelled) setCheckingSession(false);
    }, 900);

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      window.clearTimeout(fallback);
      if (data.session) {
        window.location.replace(redirectTo);
      } else {
        setCheckingSession(false);
      }
    }).catch(() => {
      if (!cancelled) {
        window.clearTimeout(fallback);
        setCheckingSession(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        window.location.replace(redirectTo);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, [redirectTo]);

  // Prefetch the signup chunk only when the user shows intent (hovers/focuses the tab)
  const prefetchSignup = () => {
    void import("@/components/auth/sign-up-form");
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* animated ambient background */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-brand-primary/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-brand-accent/20 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <motion.span
            className="inline-flex h-9 w-9 items-center justify-center rounded-brand bg-brand-primary text-primary-foreground shadow-sm"
            whileHover={{ scale: 1.08, rotate: -6 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Heart className="h-5 w-5" strokeWidth={2.4} />
          </motion.span>
          <span className="text-lg font-semibold tracking-tight">WithU</span>
        </Link>

        <motion.div
          className="rounded-brand border border-border bg-card/95 p-6 shadow-xl backdrop-blur sm:p-8"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in or create your Care Membership.
          </p>

          {!online && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-brand border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">You're offline</p>
                <p className="text-xs opacity-90">
                  Sign-in needs a connection. We'll enable the buttons as soon as you're back.
                </p>
              </div>
            </div>
          )}

          {search.reason === "session_expired" && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-brand border border-brand-primary/30 bg-brand-primary/5 p-3 text-sm text-foreground"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" />
              <div>
                <p className="font-medium">Your session expired</p>
                <p className="text-xs text-muted-foreground">
                  For your safety we signed you out. Please sign in again to pick up where you left off.
                </p>
              </div>
            </div>
          )}


          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "signin" | "signup")}
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-brand">
              <TabsTrigger value="signin" className="rounded-brand transition-all">
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-brand transition-all"
                onMouseEnter={prefetchSignup}
                onFocus={prefetchSignup}
                onTouchStart={prefetchSignup}
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: tab === "signin" ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === "signin" ? 12 : -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <TabsContent value="signin" forceMount={tab === "signin" ? true : undefined} className="mt-6">
                  {tab === "signin" && (
                    <OAuthLockGroup>
                      {(lock) => (
                        <>
                          <SignInForm redirectTo={redirectTo} lock={lock} />
                          <Divider />
                          <div className="space-y-2">
                            <OAuthButton provider="google" label="Continue with Google" redirectTo={redirectTo} lock={lock} />
                            <OAuthButton provider="apple" label="Continue with Apple" redirectTo={redirectTo} lock={lock} />
                          </div>
                        </>
                      )}
                    </OAuthLockGroup>
                  )}
                </TabsContent>

                <TabsContent value="signup" forceMount={tab === "signup" ? true : undefined} className="mt-6">
                  {tab === "signup" && (
                    <Suspense fallback={<FormSkeleton />}>
                      <OAuthLockGroup>
                        {(lock) => (
                          <>
                            <SignUpForm redirectTo={redirectTo} />
                            <Divider />
                            <div className="space-y-2">
                              <OAuthButton provider="google" label="Sign up with Google" requireAge redirectTo={redirectTo} lock={lock} />
                              <OAuthButton provider="apple" label="Sign up with Apple" requireAge redirectTo={redirectTo} lock={lock} />
                            </div>
                          </>
                        )}
                      </OAuthLockGroup>
                    </Suspense>
                  )}
                </TabsContent>

              </motion.div>
            </AnimatePresence>
          </Tabs>
        </motion.div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you confirm you are 13 or older. Not therapy or an emergency service.
        </p>
      </motion.div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-10 w-full animate-pulse rounded-brand bg-muted/60"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

type AuthLock = {
  busy: "signin" | "google" | "apple" | null;
  acquire: (owner: "signin" | "google" | "apple") => boolean;
  release: () => void;
};

function OAuthLockGroup({ children }: { children: (lock: AuthLock) => React.ReactNode }) {
  const [busy, setBusy] = useState<AuthLock["busy"]>(null);
  const busyRef = useRef<AuthLock["busy"]>(null);
  const lock: AuthLock = {
    busy,
    acquire: (owner) => {
      if (busyRef.current) return false;
      busyRef.current = owner;
      setBusy(owner);
      return true;
    },
    release: () => {
      busyRef.current = null;
      setBusy(null);
    },
  };
  return <>{children(lock)}</>;
}


function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function attemptSignIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.replace(redirectTo);
    } catch (err) {
      const info = classifyAuthError(err);
      toast.error(info.title, {
        description: info.description,
        action: info.retryable
          ? { label: "Try again", onClick: () => void attemptSignIn() }
          : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await attemptSignIn();
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      <FieldRow>
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
      </FieldRow>
      <FieldRow>
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
      </FieldRow>
      <FieldRow>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-brand bg-brand-primary text-primary-foreground shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </motion.div>
      </FieldRow>
    </motion.form>
  );
}


function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.66-.06-1.3-.17-1.9H12v3.6h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.96-4.32 2.96-7.25Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.42 13.9a5.98 5.98 0 0 1 0-3.82V7.48H3.06a10 10 0 0 0 0 9.04l3.36-2.62Z" />
      <path fill="#EA4335" d="M12 5.86c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.95 2.9 14.7 2 12 2A10 10 0 0 0 3.06 7.48l3.36 2.6C7.2 7.62 9.4 5.86 12 5.86Z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M16.37 12.63c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.4 6.63 1.1 8.8.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.52-.71 2.85-.71 1.34 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.15.84-1.24 1.19-2.44 1.21-2.5-.03-.01-2.32-.89-2.31-3.53Zm-2.2-6.48c.6-.74 1.02-1.75.9-2.77-.87.04-1.94.58-2.57 1.31-.56.65-1.06 1.7-.93 2.7.98.07 1.98-.5 2.6-1.24Z" />
    </svg>
  );
}

function OAuthButton({
  provider,
  label,
  redirectTo,
  requireAge = false,
}: {
  provider: "google" | "apple";
  label: string;
  redirectTo: string;
  requireAge?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function attempt() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth${redirectTo === "/dashboard" ? "" : `?redirect=${encodeURIComponent(redirectTo)}`}`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return; // browser navigates away
      // Popup flow: session is set — navigate immediately.
      window.location.replace(redirectTo);
    } catch (err) {
      const info = classifyAuthError(err);
      toast.error(info.title, {
        description: info.description,
        action: info.retryable
          ? { label: "Try again", onClick: () => void attempt() }
          : undefined,
      });
      setLoading(false);
    }
  }

  async function onClick() {
    if (requireAge) {
      const ok = window.confirm(
        "By continuing you confirm you are 13 or older. WithU is not available to under-13 users.",
      );
      if (!ok) return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("You're offline", {
        description: "Reconnect to the internet, then try again.",
      });
      return;
    }
    await attempt();
  }

  const providerLabel = provider === "google" ? "Google" : "Apple";

  return (
    <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-brand transition-all hover:border-brand-primary/40 hover:shadow-md"
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-brand-primary/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : provider === "google" ? (
            <GoogleIcon className="h-4 w-4" />
          ) : (
            <AppleIcon className="h-4 w-4" />
          )}
          {loading ? `Opening ${providerLabel}…` : label}
        </span>
      </Button>
    </motion.div>
  );
}
