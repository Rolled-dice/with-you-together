import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatCircleIcon, PhoneCallIcon, UsersIcon, ChartLineIcon, LifebuoyIcon, PillIcon, CalendarHeartIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { DocHeader, DocSection, Steps, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Welcome to SomeoneNear | Docs" },
      { name: "description", content: "A quick tour of SomeoneNear and how to get started in under five minutes." },
      { property: "og:title", content: "Welcome to SomeoneNear | Docs" },
      { property: "og:description", content: "A quick tour of SomeoneNear and how to get started." },
    ],
  }),
  component: Page,
});

const cards = [
  { to: "/docs/check-in", icon: PhoneCallIcon, title: "Check-In", body: "We call your loved one and tell you how they're doing." },
  { to: "/docs/companion", icon: ChatCircleIcon, title: "Companion", body: "A warm AI chat that's always awake." },
  { to: "/docs/listeners", icon: PhoneCallIcon, title: "Listeners", body: "Book a real human to call you." },
  { to: "/docs/family", icon: UsersIcon, title: "Family Circle", body: "Invite loved ones. Share care." },
  { to: "/docs/insights", icon: ChartLineIcon, title: "Insights", body: "See gentle patterns in how you feel." },
  { to: "/docs/medication", icon: PillIcon, title: "Medication", body: "Dose reminders, with or without a prescription photo." },
  { to: "/docs/send-later", icon: CalendarHeartIcon, title: "Send It Later", body: "Schedule a message for a future day." },
  { to: "/docs/safety", icon: LifebuoyIcon, title: "Safety", body: "Crisis help when it matters most." },
];

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Welcome"
        title="SomeoneNear, in five minutes"
        intro="SomeoneNear helps you check in on the people you love, and helps them feel less alone between calls. These docs show you how each part works and how to get set up fast."
      />

      <DocSection title="Quick start">
        <Steps
          items={[
            { title: "Create your account", body: "Sign up with email or Google. No card needed for the trial." },
            { title: "Tell us a little about you", body: "A short onboarding sets your tone and reminders." },
            { title: "Pick a plan (or stay on the trial)", body: "Care at $49 or Care Plus at $79, switch anytime." },
            { title: "Invite your family", body: "Send an invite link. Everyone shares your monthly Check-Ins." },
          ]}
        />
        <TryItNow to="/auth" label="Create my account" />
      </DocSection>

      <DocSection title="What's inside">
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group flex items-start gap-3 rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 font-bold group-hover:text-primary">
                  {c.title} <ArrowRightIcon className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="text-sm text-muted-foreground">{c.body}</div>
              </div>
            </Link>
          ))}
        </div>
      </DocSection>
    </>
  );
}
