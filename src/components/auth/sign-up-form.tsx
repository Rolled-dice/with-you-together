import { useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { markPhoneVerified } from "@/lib/profile.functions";
import { FieldRow } from "@/components/auth/field-row";

const TEST_PHONE_NUMBER = import.meta.env.VITE_PHONE_TEST_NUMBER ?? "+919999999999";
const TEST_PHONE_CODE = import.meta.env.VITE_PHONE_TEST_CODE ?? "123456";

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

type Stage = "form" | "otp";

export function SignUpForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);

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
    if (age === null) return toast.error("Please enter your date of birth.");
    if (age < 13) return toast.error("Sorry — BesideU is not available to users under 13.");
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
          full_name: fullName,
          display_name: fullName,
          date_of_birth: dob,
          phone: e164,
          phone_country: country,
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
    toast.success("Welcome to BesideU!");
    window.location.replace(redirectTo);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!e164) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp,
      type: "phone_change",
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    try {
      await markPhoneVerified({ data: { phone: e164, phone_country: country } });
    } catch {
      // non-fatal
    }
    setLoading(false);
    toast.success("Phone verified. Welcome to BesideU.");
    window.location.replace(redirectTo);
  }

  async function resendOtp() {
    if (!e164) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`New code sent to ${e164}`);
  }

  const maxDob = new Date().toISOString().slice(0, 10);

  if (stage === "otp") {
    return (
      <motion.form
        onSubmit={verify}
        className="space-y-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="rounded-brand border border-border bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-brand-accent" />
            Verify your mobile number
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We sent a 6-digit code to <strong>{e164}</strong>.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="rounded-brand tracking-widest text-center"
            placeholder={TEST_PHONE_CODE}
          />
        </div>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={loading || otp.length < 4}
            className="w-full rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify & continue
          </Button>
        </motion.div>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 rounded-brand"
            onClick={() => setStage("form")}
            disabled={loading}
          >
            Change number
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 rounded-brand"
            onClick={resendOtp}
            disabled={loading}
          >
            Resend code
          </Button>
        </div>
      </motion.form>
    );
  }

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
            placeholder={TEST_PHONE_NUMBER}
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
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-brand bg-brand-primary text-primary-foreground shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow-md"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create account
          </Button>
        </motion.div>
      </FieldRow>
    </motion.form>
  );
}
