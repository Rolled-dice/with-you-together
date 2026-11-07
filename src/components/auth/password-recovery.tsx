import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordRecovery({ reset, onBack }: { reset: boolean; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (reset && password !== confirmation) return setError("The passwords do not match.");
    setBusy(true);
    try {
      if (reset) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("This recovery link has expired. Request a new link.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut({ scope: "local" });
        window.location.replace("/auth?reason=signed_out");
      } else {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?mode=recovery`,
        });
        if (requestError) throw requestError;
        setMessage("If an account exists for this email, you’ll receive a password reset link.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to reset your password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold">
        {reset ? "Choose a new password" : "Reset your password"}
      </h2>
      {reset ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirmation">Confirm new password</Label>
            <Input
              id="reset-confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="recovery-email">Email</Label>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Please wait…" : reset ? "Save new password" : "Send reset link"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Back to sign in
      </Button>
    </form>
  );
}
