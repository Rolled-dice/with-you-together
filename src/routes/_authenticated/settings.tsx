import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile, markPhoneVerified } from "@/lib/profile.functions";
import {
  listMemories as listMemoriesFn,
  createMemory as createMemoryFn,
  deleteMemory as deleteMemoryFn,
} from "@/lib/memories.functions";
import {
  createBillingPortalSession,
  getMySubscription,
} from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, HeartHandshake, Loader2, LogOut, Sparkles } from "lucide-react";
import { WebhookEventsCard } from "@/components/webhook-events-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import {
  PLAN_DISPLAY,
  currencyForCountry,
  priceIdFor,
  displayPrice,
  type Currency,
  type PlanId,
} from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SomeoneNear" },
      {
        name: "description",
        content: "Manage your Care Membership, profile, and consent preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

type TierId = "free" | "together" | "family" | "care";

function SettingsPage() {
  const profileFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const portalFn = useServerFn(createBillingPortalSession);
  const subFn = useServerFn(getMySubscription);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => profileFn(),
  });

  const { data: subscription, refetch: refetchSub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => subFn({ data: { environment: getStripeEnvironment() } }),
  });

  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [timezone, setTimezone] = useState("");
  const [intent, setIntent] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [currency, setCurrency] = useState<Currency>("usd");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setFullName((profile as any).full_name ?? "");
    setPronouns(profile.pronouns ?? "");
    setTimezone(profile.timezone ?? "");
    setIntent(profile.care_intent ?? "");
    setPhone(((profile as any).phone as string | null) ?? "");
    setLanguage(((profile as any).preferred_language as "en" | "hi") ?? "en");
    const prefCur = (profile as any).preferred_currency as Currency | null;
    setCurrency(prefCur ?? currencyForCountry((profile as any).phone_country));
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`sub:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["me"] });
          refetchSub();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, qc, refetchSub]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          display_name: displayName || null,
          full_name: fullName || null,
          pronouns: pronouns || null,
          timezone: timezone || null,
          care_intent: intent || null,
          preferred_language: language,
          preferred_currency: currency,
          phone: phone.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const portalMut = useMutation({
    mutationFn: async () => {
      const res = await portalFn({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/settings`,
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res.url;
    },
    onSuccess: (url) => {
      window.open(url, "_blank");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  if (isLoading || !profile) {
    return (
      <AppShell>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-56" />
        </div>
      </AppShell>
    );
  }

  const currentTier: TierId = (profile.care_tier as TierId) ?? "free";
  const hasPaidSub =
    !!subscription &&
    subscription.status !== "canceled" &&
    subscription.status !== "incomplete_expired";
  // Infer the active plan from the live subscription price when the profile
  // hasn't synced yet — prevents "no card looks active" state.
  const subTier: TierId | null = (() => {
    const p = (subscription?.price_id as string | undefined) ?? "";
    if (p.startsWith("care")) return "care";
    if (p.startsWith("family")) return "family";
    if (p.startsWith("together")) return "together";
    return null;
  })();
  const activeTier: TierId =
    currentTier !== "free" ? currentTier : (subTier ?? "free");
  const cancelsAt =
    subscription?.cancel_at_period_end && subscription.current_period_end
      ? new Date(subscription.current_period_end as string).toLocaleDateString()
      : null;

  const plans: PlanId[] = ["together", "family", "care"];

  return (
    <AppShell>
      <PaymentTestModeBanner />
      <PageHeader
        eyebrow="Settings"
        slogan="Made just for you."
        title="Your preferences"
        description="Care Membership, profile, and privacy — all in your hands."
      />

      <div className="grid gap-6">
        <Card className="rounded-brand border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <HeartHandshake className="h-4 w-4 text-brand-accent" />
              Care Membership
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {cancelsAt ? (
              <div className="rounded-brand border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                Your membership will end on <strong>{cancelsAt}</strong>. You'll keep access until then.
              </div>
            ) : null}
            {hasPaidSub ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-brand border border-border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">
                  Active subscription
                  {subTier ? ` — ${PLAN_DISPLAY[subTier as PlanId].name}` : ""}
                  {subscription?.status === "trialing" ? " (in free trial)" : ""}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => portalMut.mutate()}
                  disabled={portalMut.isPending}
                  className="rounded-brand"
                >
                  {portalMut.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : null}
                  Manage or cancel
                </Button>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Billed monthly in your local currency.
              </p>
              <div className="inline-flex rounded-brand border border-border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCurrency("inr")}
                  className={cn(
                    "rounded-brand px-3 py-1 transition",
                    currency === "inr"
                      ? "bg-card font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("usd")}
                  className={cn(
                    "rounded-brand px-3 py-1 transition",
                    currency === "usd"
                      ? "bg-card font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  $ USD
                </button>
              </div>
            </div>

            {/* Plans (no free tier — 7-day trial is on Together) */}
            <div className="grid gap-3 md:grid-cols-3">


              {plans.map((plan) => {
                const info = PLAN_DISPLAY[plan];
                const active = activeTier === plan;
                const priceId = priceIdFor(plan, currency);
                const showTrialCTA = plan === "together" && !hasPaidSub;
                return (
                  <div
                    key={plan}
                    className={cn(
                      "flex flex-col gap-3 rounded-brand border p-4",
                      active
                        ? "border-brand-primary bg-brand-primary/5"
                        : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{info.name}</span>
                      {active ? (
                        <Badge className="rounded-full bg-brand-primary text-primary-foreground">
                          <Check className="mr-1 h-3 w-3" /> Current
                        </Badge>
                      ) : showTrialCTA ? (
                        <Badge variant="secondary" className="rounded-full">
                          7-day free trial
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {displayPrice(plan, currency)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">per month</div>
                    </div>
                    <ul className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      {info.bullets.map((b) => (
                        <li key={b}>· {b}</li>
                      ))}
                      {showTrialCTA ? (
                        <li className="text-brand-primary">
                          · Try free for 7 days — auto-billed after, cancel anytime.
                        </li>
                      ) : null}
                    </ul>
                    {active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => portalMut.mutate()}
                        disabled={portalMut.isPending}
                        className="rounded-brand"
                      >
                        {portalMut.isPending ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : null}
                        Manage or cancel
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          hasPaidSub
                            ? portalMut.mutate()
                            : navigate({
                                to: "/checkout",
                                search: { price: priceId as any },
                              })
                        }
                        className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
                      >
                        <Sparkles className="mr-2 h-3 w-3" />
                        {hasPaidSub
                          ? "Switch in billing portal"
                          : showTrialCTA
                            ? "Start 7-day free trial"
                            : "Choose plan"}
                      </Button>
                    )}
                  </div>
                );
              })}

            </div>
          </CardContent>
        </Card>

        <Card className="rounded-brand border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-brand"
              />
            </Field>
            <Field label="Display name">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-brand"
              />
            </Field>
            <Field label="Pronouns">
              <Input
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="e.g. she/her"
                className="rounded-brand"
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
                className="rounded-brand"
              />
            </Field>
            <Field label="Language">
              <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "hi")}>
                <SelectTrigger className="rounded-brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                English by default. More languages coming.
              </p>
            </Field>
            <Field label="Mobile number">
              <div className="flex items-center gap-2">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 1234"
                  inputMode="tel"
                  autoComplete="tel"
                  className="rounded-brand"
                />
                {(profile as any).phone_verified && phone === ((profile as any).phone ?? "") ? (
                  <Badge className="rounded-full bg-emerald-100 text-emerald-800">Verified</Badge>
                ) : (
                  <PhoneVerifyDialog
                    phone={phone}
                    country={(profile as any).phone_country ?? "IN"}
                    onVerified={() => qc.invalidateQueries({ queryKey: ["me"] })}
                  />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Include your country code. This is the number your listener calls and where
                reminders go.
              </p>
            </Field>
            <Field label="What brings you here?">
              <Textarea
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="min-h-20 rounded-brand"
              />
            </Field>
            <div className="md:col-span-2 flex justify-end">
              <Button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
              >
                {saveMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <BillingHistoryCard />

        {profile?.id && <WebhookEventsCard userId={profile.id} />}

        <Card className="rounded-brand border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleSignOut} className="rounded-brand">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <CompanionMemoryCard />
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PhoneVerifyDialog({
  phone,
  country,
  onVerified,
}: {
  phone: string;
  country: string;
  onVerified: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const markFn = useServerFn(markPhoneVerified);

  async function sendOtp() {
    if (!phone) return toast.error("No phone number on file.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ phone });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Code sent to ${phone}`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "phone_change",
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    try {
      await markFn({ data: { phone, phone_country: country } });
    } catch {
      // non-fatal
    }
    setLoading(false);
    toast.success("Phone verified.");
    setOpen(false);
    onVerified();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          Verify
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-brand">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Verify mobile number</DialogTitle>
          <DialogDescription>
            We’ll send a one-time code to <strong>{phone || "your number"}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={verify} className="space-y-4">
          <div className="rounded-brand border border-dashed border-brand-accent/40 bg-brand-accent/5 p-3 text-xs text-muted-foreground">
            <strong className="block text-brand-accent">Test mode</strong>
            Use the test number configured in Supabase Auth with its fixed code.
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-otp">Verification code</Label>
            <Input
              id="settings-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="rounded-brand tracking-widest text-center"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={sendOtp}
              disabled={loading}
              className="flex-1 rounded-brand"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send code"}
            </Button>
            <Button
              type="submit"
              disabled={loading || otp.length < 4}
              className="flex-1 rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EVENT_LABELS: Record<string, string> = {
  "checkout.completed": "Checkout completed",
  "invoice.paid": "Payment received",
  "invoice.payment_succeeded": "Payment received",
  "invoice.payment_failed": "Payment failed",
  "subscription.created": "Subscription started",
  "subscription.updated": "Subscription updated",
  "subscription.canceled": "Subscription canceled",
  "tier.started": "Membership started",
  "tier.ended": "Membership ended",
  "tier.upgraded": "Upgraded",
  "tier.downgraded": "Downgraded",
  "tier.changed": "Tier changed",
};

function formatMoney(cents: number | null, currency: string | null) {
  if (cents == null || !currency) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function BillingHistoryCard() {
  const env = getStripeEnvironment();
  const { data, isLoading } = useQuery({
    queryKey: ["billing-events", env],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_events")
        .select(
          "id, event_type, previous_tier, new_tier, amount_cents, currency, status, created_at",
        )
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base font-medium">Billing history</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-brand" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No billing activity yet. Purchases, renewals, and plan changes will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((e) => {
              const money = formatMoney(e.amount_cents, e.currency);
              const label = EVENT_LABELS[e.event_type] ?? e.event_type;
              const tierChange =
                e.previous_tier && e.new_tier && e.previous_tier !== e.new_tier
                  ? `${e.previous_tier} → ${e.new_tier}`
                  : null;
              return (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                      {tierChange ? ` · ${tierChange}` : ""}
                    </span>
                  </div>
                  {money ? (
                    <span className="text-sm font-medium tabular-nums">{money}</span>
                  ) : e.status ? (
                    <Badge variant="secondary" className="rounded-brand">
                      {e.status}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CompanionMemoryCard() {
  const listFn = useServerFn(listMemoriesFn);
  const createFn = useServerFn(createMemoryFn);
  const deleteFn = useServerFn(deleteMemoryFn);
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => listFn(),
  });

  const addMut = useMutation({
    mutationFn: () => createFn({ data: { content } }),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Saved. The Companion will remember this.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories"] }),
  });

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base font-medium">Companion memory</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Short notes you'd like the Companion to keep in mind — only you can see these.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            placeholder="e.g. I use they/them. Walks help when I'm anxious."
            className="rounded-brand"
          />
          <Button
            onClick={() => addMut.mutate()}
            disabled={!content.trim() || addMut.isPending}
            className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
            {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-brand" />
        ) : memories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No memories yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="flex-1">{m.content}</span>
                <button
                  type="button"
                  onClick={() => delMut.mutate(m.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
