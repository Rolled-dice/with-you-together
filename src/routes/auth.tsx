import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";
import { markPhoneVerified } from "@/lib/profile.functions";

export const Route = createFileRoute("/auth")({
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
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-brand bg-brand-primary text-primary-foreground shadow-sm">
            <Heart className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-semibold tracking-tight">WithU</span>
        </Link>

        <div className="rounded-brand border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in or create your Care Membership.
          </p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2 rounded-brand">
              <TabsTrigger value="signin" className="rounded-brand">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-brand">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <SignInForm />
              <Divider />
              <div className="space-y-2">
                <OAuthButton provider="google" label="Continue with Google" />
                <OAuthButton provider="apple" label="Continue with Apple" />
              </div>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <SignUpForm />
              <Divider />
              <div className="space-y-2">
                <OAuthButton provider="google" label="Sign up with Google" requireAge />
                <OAuthButton provider="apple" label="Sign up with Apple" requireAge />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you confirm you are 13 or older. Not therapy or an emergency service.
        </p>
      </div>
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

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-brand"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-brand"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
      >
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

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

const TEST_PHONE_NUMBER = import.meta.env.VITE_PHONE_TEST_NUMBER ?? "+919999999999";
const TEST_PHONE_CODE = import.meta.env.VITE_PHONE_TEST_CODE ?? "123456";

type Stage = "form" | "otp";

function SignUpForm() {
  const navigate = useNavigate();
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
    if (age < 13) return toast.error("Sorry — WithU is not available to users under 13.");
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
        emailRedirectTo: window.location.origin,
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
    toast.success("Welcome to WithU!");
    navigate({ to: "/dashboard", replace: true });
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
    toast.success("Phone verified. Welcome to WithU.");
    navigate({ to: "/dashboard", replace: true });
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
      <form onSubmit={verify} className="space-y-4">
        <div className="rounded-brand border border-border bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-brand-accent" />
            Verify your mobile number
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We sent a 6-digit code to <strong>{e164}</strong>. Verification is required before you can continue.
          </p>
        </div>

        <div className="rounded-brand border border-dashed border-brand-accent/40 bg-brand-accent/5 p-3 text-xs text-muted-foreground">
          <strong className="block text-brand-accent">Test mode</strong>
          Phone OTP is currently using the Supabase test provider. In test mode, use number{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-medium">{TEST_PHONE_NUMBER}</code>{" "}
          with code{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-medium">{TEST_PHONE_CODE}</code>.
          Set <code className="rounded bg-muted px-1 py-0.5">VITE_PHONE_TEST_NUMBER</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5">VITE_PHONE_TEST_CODE</code> in your preview environment to match the values configured in your backend.
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
          />
        </div>
        <Button
          type="submit"
          disabled={loading || otp.length < 4}
          className="w-full rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Verify & continue
        </Button>
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
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">


      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-brand"
          placeholder="Your name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-brand"
        />
      </div>
      <div className="space-y-2">
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
            className="rounded-brand flex-1"
            placeholder={TEST_PHONE_NUMBER}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          We'll send a one-time code to verify this number. Used for account security and to bill in your local currency.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-brand"
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-dob">Date of birth</Label>
        <Input
          id="signup-dob"
          type="date"
          required
          max={maxDob}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="rounded-brand"
        />
        <p className="text-xs text-muted-foreground">
          WithU is not available to users under 13.
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Create account
      </Button>
    </form>
  );
}

function OAuthButton({
  provider,
  label,
  requireAge = false,
}: {
  provider: "google" | "apple";
  label: string;
  requireAge?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (requireAge) {
      const ok = window.confirm(
        "By continuing you confirm you are 13 or older. WithU is not available to under-13 users.",
      );
      if (!ok) return;
    }
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    setLoading(false);
    if (result.error) toast.error(result.error.message ?? "Sign in failed");
  }

  const providerLabel = provider === "google" ? "Google" : "Apple";

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-brand"
    >
      {loading ? `Opening ${providerLabel}…` : label}
    </Button>
  );
}
