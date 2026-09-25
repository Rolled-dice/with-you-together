import { useMemo, useState } from "react";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";

import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldRow } from "@/components/auth/field-row";

const PHONE_PLACEHOLDER = "+91 98765 43210";

function ageFromDob(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function SignUpForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);

  const countryOptions = useMemo(() => {
    return getCountries().map((c) => ({
      code: c,
      dial: `+${getCountryCallingCode(c)}`,
    }));
  }, []);

  const e164 = useMemo(() => {
    if (!phone) return null;
    const parsed = parsePhoneNumberFromString(phone, country);
    return parsed?.isValid() ? parsed.number : null;
  }, [phone, country]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const age = ageFromDob(dob);
    if (!legalAccepted) {
      return toast.error("Please accept the Terms of Service and Privacy Policy.");
    }

    if (age < 18 && !guardianConfirmed) {
      return toast.error("A parent or legal guardian must approve your use of SomeoneNear.");
    }

    if (age === null) return toast.error("Please enter your date of birth.");
    if (age < 13) return toast.error("Sorry, SomeoneNear is not available to users under 13.");
    if (age > 120) return toast.error("Please enter a valid date of birth.");
    if (!fullName.trim()) return toast.error("Please enter your name.");
    if (!e164 || !isValidPhoneNumber(phone, country)) {
      return toast.error("Please enter a valid mobile number.");
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth${redirectTo === "/dashboard" ? "" : `?redirect=${encodeURIComponent(redirectTo)}`}`,
        data: {
          data: {
            full_name: fullName,
            display_name: fullName,
            date_of_birth: dob,
            phone: e164,
            phone_country: country,
            legal_terms_accepted_at: new Date().toISOString(),
            terms_version: "2026-09-25",
            privacy_version: "2026-09-25",
            guardian_consent_confirmed: age < 18,
          },
        },
      },
    });
    setLoading(false);
    if (error) {
      return toast.error(error.message);
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account, then sign in.");
      return;
    }
    toast.success("Welcome to SomeoneNear!");
    window.location.replace(redirectTo);
  }

  const maxDob = new Date().toISOString().slice(0, 10);

  return (
    <motion.form
      onSubmit={onSubmit}
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05 } },
      }}
    >
      <FieldRow>
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          placeholder="Your name"
        />
      </FieldRow>
      <FieldRow>
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
      </FieldRow>
      <FieldRow>
        <Label>Mobile number</Label>
        <div className="flex gap-2">
          <Select value={country} onValueChange={(v) => setCountry(v as CountryCode)}>
            <SelectTrigger className="w-[120px] rounded-brand">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {countryOptions.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} {c.dial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-brand flex-1 transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            placeholder={PHONE_PLACEHOLDER}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Used for account security and to bill in your local currency.
        </p>
      </FieldRow>
      <FieldRow>
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          placeholder="At least 8 characters"
        />
      </FieldRow>
      <FieldRow>
        <Label htmlFor="signup-dob">Date of birth</Label>
        <Input
          id="signup-dob"
          type="date"
          required
          max={maxDob}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="rounded-brand transition-all focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
      </FieldRow>
      <FieldRow>
        <div className="flex items-start gap-3">
          <Checkbox
            id="legal-acceptance"
            checked={legalAccepted}
            onCheckedChange={(checked) => setLegalAccepted(checked === true)}
            aria-required="true"
          />

          <Label htmlFor="legal-acceptance" className="text-sm font-normal leading-relaxed">
            I agree to the{" "}
            <Link to="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-4">
              Terms of Service
            </Link>{" "}
            and acknowledge the{" "}
            <Link to="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
      </FieldRow>

      <FieldRow>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-brand bg-brand-primary text-primary-foreground shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow-md"
          >
            {loading ? <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create account
          </Button>
        </motion.div>
      </FieldRow>
    </motion.form>
  );
}
