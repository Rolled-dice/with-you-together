import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getFamilyDeliveryConfig } from "@/lib/family.functions";
import { FamilyPhone } from "@/lib/family.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneIcon } from "@phosphor-icons/react";

export function PhoneSignIn({ redirectTo }: { redirectTo: string }) {
  const config = useServerFn(getFamilyDeliveryConfig);
  const query = useQuery({ queryKey: ["family-delivery"], queryFn: () => config() });
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [legal, setLegal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSent, setLastSent] = useState(0);
  if (!query.data?.phoneLogin) return null;
  async function send() {
    if (Date.now() - lastSent < 60_000)
      throw new Error("Wait a minute before requesting another code.");
    const normalized = FamilyPhone.parse(phone);
    if (!legal) throw new Error("Please accept the terms and confirm your age.");
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: {
        data: {
          legal_terms_accepted_at: new Date().toISOString(),
          terms_version: "2026-09-25",
          privacy_version: "2026-09-25",
          adult_confirmed: true,
        },
      },
    });
    if (error)
      throw new Error("The code could not be sent. Check your number or try email sign-in.");
    setSentTo(normalized);
    setLastSent(Date.now());
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!sentTo) await send();
      else {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: sentTo,
          token: code,
          type: "sms",
        });
        if (error || !data.session)
          throw new Error("That code is invalid or expired. Try again or request another code.");
        window.location.replace(redirectTo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 border-b border-border pb-5">
      <Button
        variant="outline"
        className="min-h-12 w-full"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <PhoneIcon /> Use a phone code
      </Button>
      {open && (
        <form className="mt-4 grid gap-3" onSubmit={submit}>
          {!sentTo ? (
            <>
              <Label htmlFor="signin-phone">Phone number with country code</Label>
              <Input
                id="signin-phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 or +1, then your number"
              />
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={legal}
                  required
                  onChange={(e) => setLegal(e.target.checked)}
                />
                <span>
                  I am 18 or older and accept the{" "}
                  <Link to="/terms" className="underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            </>
          ) : (
            <>
              <p className="break-all text-sm">Code sent to {sentTo}</p>
              <Label htmlFor="signin-otp">Six-digit code</Label>
              <Input
                id="signin-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await send();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send another code
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setSentTo("");
                  setCode("");
                }}
              >
                Change number
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy}>
            {busy ? "Please wait..." : sentTo ? "Verify and continue" : "Send code"}
          </Button>
        </form>
      )}
    </section>
  );
}
