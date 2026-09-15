import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircleHeart, PhoneCall, Users, LineChart, LifeBuoy, Pill, ArrowRight } from "lucide-react";
import { DocHeader, DocSection, Steps, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Welcome to SomeoneNear | Docs" },
      { name: "description", content: "A quick tour of SomeoneNear and how to get started in under five minutes." },
      { property: "og:title", content: "Welcome to SomeoneNear, Docs" },
      { property: "og:description", content: "A quick tour of SomeoneNear and how to get started." },
    ],
  }),
  component: Page,
});

const cards = [
  { to: "/docs/companion", icon: MessageCircleHeart, title: "Companion", body: "A warm AI chat that's always awake." },
  { to: "/docs/listeners", icon: PhoneCall, title: "Listeners", body: "Book a real human to call you." },
  { to: "/docs/family", icon: Users, title: "Family Circle", body: "Invite loved ones. Share care." },
  { to: "/docs/insights", icon: LineChart, title: "Insights", body: "See gentle patterns in how you feel." },
  { to: "/docs/medication", icon: Pill, title: "Medication", body: "Dose reminders, with or without a prescription photo." },
  { to: "/docs/safety", icon: LifeBuoy, title: "Safety", body: "Crisis help when it matters most." },
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
            { title: "Pick a plan (or stay on the trial)", body: "Together, Family, or Care | switch anytime." },
            { title: "Invite your family", body: "Send an invite link. Everyone shares your session minutes." },
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
              className="group flex items-start gap-3 rounded-2xl border p-4 transition hover:border-coral hover:bg-coral/5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral/10 text-coral">
                <c.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 font-semibold group-hover:text-coral">
                  {c.title} <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
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
