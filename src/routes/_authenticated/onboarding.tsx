import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome | SomeoneNear" },
      { name: "description", content: "A few gentle questions to set up your SomeoneNear space." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const [careIntent, setCareIntent] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, pronouns, timezone, care_intent, phone")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setPronouns(profile.pronouns ?? "");
        setTimezone(profile.timezone ?? timezone);
        setCareIntent(profile.care_intent ?? "");
        setPhone((profile as { phone?: string | null }).phone ?? "");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Please share what we can call you.");
      return;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !/^\+?[0-9][0-9\s-]{6,17}$/.test(trimmedPhone)) {
      toast.error("Please enter a valid mobile number with country code.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        pronouns: pronouns.trim() || null,
        timezone,
        care_intent: careIntent.trim() || null,
        phone: trimmedPhone || null,
        onboarding_completed: true,
      })
      .eq("id", userData.user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You're all set. Welcome to SomeoneNear.");
    navigate({ to: "/dashboard" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex items-center gap-2 text-brand-primary">
          <Heart className="h-5 w-5" />
          <span className="text-sm font-medium tracking-wide">SomeoneNear</span>
        </div>
        <Card className="rounded-brand border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">A gentle welcome</CardTitle>
            <CardDescription>
              A few soft questions so SomeoneNear can meet you where you are. Nothing here is shared , 
              it's yours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="displayName">What can we call you?</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="A name or nickname"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="pronouns">Pronouns (optional)</Label>
                <Input
                  id="pronouns"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="e.g. she/her, they/them"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Mobile number (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 1234"
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Include your country code. This is where a listener calls you and where reminders
                  arrive. You can change it any time in Settings.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="timezone">Your timezone</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  So daily check-ins arrive at a kind hour for you.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="intent">What are you hoping SomeoneNear can hold for you?</Label>
                <Textarea
                  id="intent"
                  value={careIntent}
                  onChange={(e) => setCareIntent(e.target.value)}
                  placeholder="Optional, a sentence or a whole page, whatever feels right."
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enter SomeoneNear
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
