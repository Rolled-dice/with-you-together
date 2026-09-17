import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LifebuoyIcon, PhoneIcon, ChatIcon, GlobeIcon, ShieldCheckIcon, HeartbeatIcon } from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/safety")({
  component: SafetyPage,
  head: () => ({
    meta: [
      { title: "Safety & Crisis Support · SomeoneNear" },
      { name: "description", content: "Immediate crisis resources, hotlines, and grounding tools when you need someone right now." },
    ],
  }),
});

type Resource = {
  region: string;
  name: string;
  detail: string;
  phone?: string;
  sms?: string;
  smsBody?: string;
  url?: string;
};

const EMERGENCY: { region: string; number: string }[] = [
  { region: "US / Canada", number: "911" },
  { region: "UK / Ireland", number: "999" },
  { region: "EU", number: "112" },
  { region: "Australia", number: "000" },
];

const HOTLINES: Resource[] = [
  { region: "United States", name: "988 Suicide & Crisis Lifeline", detail: "24/7 free, confidential support in English & Spanish.", phone: "988", sms: "988", url: "https://988lifeline.org" },
  { region: "United States", name: "Crisis Text Line", detail: "Text HOME to reach a trained volunteer counselor.", sms: "741741", smsBody: "HOME", url: "https://www.crisistextline.org" },
  { region: "United Kingdom & ROI", name: "Samaritans", detail: "24/7 listening line, you don't have to be suicidal to call.", phone: "116 123", url: "https://www.samaritans.org" },
  { region: "Canada", name: "Talk Suicide Canada", detail: "24/7 phone; text available 4pm-midnight ET.", phone: "1-833-456-4566", sms: "45645", url: "https://talksuicide.ca" },
  { region: "Australia", name: "Lifeline Australia", detail: "24/7 crisis support and suicide prevention.", phone: "13 11 14", sms: "0477 13 11 14", url: "https://www.lifeline.org.au" },
  { region: "India", name: "iCall", detail: "Mon-Sat, 8am-10pm. Free psychosocial support.", phone: "9152987821", url: "https://icallhelpline.org" },
  { region: "Global", name: "Find A Helpline", detail: "Verified helplines in 130+ countries.", url: "https://findahelpline.com" },
];

const GROUNDING = [
  { title: "5-4-3-2-1", body: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste." },
  { title: "Box breathing", body: "Inhale 4s → hold 4s → exhale 4s → hold 4s. Repeat 4 rounds." },
  { title: "Cold water", body: "Splash cold water on your face or hold ice | resets the vagus nerve." },
  { title: "One small text", body: "Message one person: 'Thinking of you.' You don't have to explain." },
];

function SafetyPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="You're not alone"
        slogan="You are not alone tonight."
        title="Safety & crisis support"
        description="If you or someone you love is in danger, please reach out to a real person right now. SomeoneNear is a companion, not a replacement for a human in a crisis."
      />

      <div className="rounded-brand border border-destructive/30 bg-destructive/5 p-5 mb-8 animate-fade-up">
        <div className="flex gap-4">
          <LifebuoyIcon className="h-6 w-6 shrink-0 text-destructive mt-0.5 animate-heartbeat" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">In immediate danger? Tap to call your local emergency line.</p>
            <p className="text-sm text-muted-foreground mt-1">
              One tap dials from your phone. If you're on desktop, use any nearby phone.
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EMERGENCY.map((e, i) => (
                <a
                  key={e.region}
                  href={`tel:${e.number}`}
                  aria-label={`Call ${e.region} emergency ${e.number}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className="flex flex-col items-center justify-center rounded-brand bg-destructive px-3 py-3 text-destructive-foreground font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition animate-pop-in card-lift"
                >
                  <span className="flex items-center gap-1.5 text-base"><PhoneIcon className="h-4 w-4" /> {e.number}</span>
                  <span className="text-[11px] opacity-90 font-normal mt-0.5">{e.region}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mb-10 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><PhoneIcon className="h-4 w-4 text-brand-accent" /> Hotlines & text lines</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {HOTLINES.map((r, i) => (
            <div
              key={r.name}
              style={{ animationDelay: `${i * 70}ms` }}
              className="rounded-brand border border-border bg-surface p-4 flex flex-col animate-fade-up card-lift"
            >
              <p className="text-xs uppercase tracking-wide text-brand-accent font-medium">{r.region}</p>
              <p className="font-semibold text-foreground mt-1">{r.name}</p>
              <p className="text-sm text-muted-foreground mt-1 flex-1">{r.detail}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {r.phone && (
                  <a
                    href={`tel:${r.phone.replace(/\s/g, "")}`}
                    aria-label={`Call ${r.name} at ${r.phone}`}
                    className="inline-flex items-center justify-center gap-2 rounded-brand bg-brand-primary px-3 py-2.5 text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition"
                  >
                    <PhoneIcon className="h-4 w-4" /> Call {r.phone}
                  </a>
                )}
                {r.sms && (
                  <a
                    href={`sms:${r.sms}${r.smsBody ? `?&body=${encodeURIComponent(r.smsBody)}` : ""}`}
                    aria-label={`Text ${r.name} at ${r.sms}`}
                    className="inline-flex items-center justify-center gap-2 rounded-brand bg-brand-accent px-3 py-2.5 text-white font-semibold text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition"
                  >
                    <ChatIcon className="h-4 w-4" /> Text {r.sms}
                  </a>
                )}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-brand border border-border px-3 py-2 text-muted-foreground hover:text-foreground text-sm sm:col-span-2">
                    <GlobeIcon className="h-3.5 w-3.5" /> Visit website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 animate-fade-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><HeartbeatIcon className="h-4 w-4 text-brand-accent" /> Grounding right now</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUNDING.map((g, i) => (
            <div
              key={g.title}
              style={{ animationDelay: `${i * 70}ms` }}
              className="rounded-brand border border-border bg-surface p-4 animate-pop-in card-lift"
            >
              <p className="font-semibold text-foreground">{g.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-brand border border-border bg-surface p-5 animate-fade-up" style={{ animationDelay: "280ms" }}>
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-brand-accent mt-0.5" />
          <div>
            <p className="font-semibold">How SomeoneNear handles crisis moments</p>
            <p className="text-sm text-muted-foreground mt-1">
              When our Companion detects language suggesting self-harm or acute danger, it pauses normal responses and surfaces these resources. Nothing you share here is used to train models, and family members never see your Companion conversations or mood check-ins.
            </p>
            <div className="mt-3 flex gap-2 text-sm">
              <Link to="/companion" className="rounded-brand bg-brand-primary px-3 py-1.5 text-primary-foreground font-medium">Talk to Companion</Link>
              <Link to="/listeners" className="rounded-brand border border-border px-3 py-1.5 text-foreground">Book a Listener</Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
