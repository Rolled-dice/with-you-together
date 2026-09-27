import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldRow } from "@/components/auth/field-row";

export const Route = createFileRoute("/auth_/reset")({
  head: () => ({
    meta: [
      { title: "Reset password | SomeoneNear" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  // Phases: checking the recovery link -> ready to set a new password ->
  // done. If the link is invalid/expired we surface an error state.
  const [phase, setPhase] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setPhase(ok ? "ready" : "invalid");
    };

    async function establish() {
      // The recovery link returns the session in the URL hash:
      //   #access_token=...&refresh_token=...&type=recovery
      // Parse and set it explicitly rather than relying on detectSessionInUrl,
      // which can race with (or have already consumed) the hash on navigation.
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error && data.session) {
          // Clean the tokens out of the URL so a refresh/copy can't leak them.
          window.history.replaceState(null, "", "/auth/reset");
          finish(true);
          return;
        }
      }

      // Fallback: maybe the client already established a session from the URL.
      const { data } = await supabase.auth.getSession();
      finish(Boolean(data.session));
    }

    void establish();

    // Safety timeout in case setSession hangs.
    const timer = window.setTimeout(() => finish(false), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    // Sign out the temporary recovery session and send the user to sign in
    // fresh with their new password.
    await supabase.auth.signOut();
    setSaving(false);
    setPhase("done");
    toast.success("Password updated. Please sign in with your new password.");
    setTimeout(() => window.location.replace("/auth"), 1200);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <motion.div
        className="w-full max-w-md rounded-brand border border-border bg-card p-6 shadow-gentle sm:p-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {phase === "checking" && (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <SpinnerGapIcon className="h-6 w-6 animate-spin text-brand-primary" />
            <p className="text-sm">Checking your reset link…</p>
          </div>
        )}

        {phase === "invalid" && (
          <div className="space-y-3 text-center">
            <h1 className="font-display text-2xl font-medium">Link expired</h1>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button
              onClick={() => window.location.replace("/auth")}
              className="mt-2 w-full rounded-brand bg-brand-primary text-primary-foreground"
            >
              Back to sign in
            </Button>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-2 py-6 text-center">
            <h1 className="font-display text-2xl font-medium">Password updated</h1>
            <p className="text-sm text-muted-foreground">Taking you to sign in…</p>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-medium">Set a new password</h1>
              <p className="text-sm text-muted-foreground">Choose a new password for your SomeoneNear account.</p>
            </div>
            <FieldRow>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              />
            </FieldRow>
            <FieldRow>
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              />
            </FieldRow>
            <Button
              type="submit"
              disabled={saving || password.length < 8 || password !== confirm}
              className="w-full rounded-brand bg-brand-primary text-primary-foreground shadow-sm transition-all hover:bg-brand-primary/90"
            >
              {saving ? <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update password
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
