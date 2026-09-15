import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/medication")({
  head: () => ({
    meta: [
      { title: "Medication reminders | SomeoneNear Docs" },
      { name: "description", content: "Add medicines from a prescription photo or by hand, and get gentle dose reminders." },
      { property: "og:title", content: "Medication reminders | SomeoneNear Docs" },
      { property: "og:description", content: "Add medicines from a photo and get gentle dose reminders." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Medication reminders"
        intro="Never wonder “did they take it?” again, gentle dose nudges for you or someone you care for."
      />

      <DocSection title="What it is">
        <p>
          Add a medicine once and SomeoneNear keeps an eye on the schedule, for you, or for a
          family member you look after. At each dose time we send a gentle reminder, and a single
          tap on <strong>Taken</strong> or <strong>Skip</strong> logs the dose.
        </p>
      </DocSection>

      <DocSection title="Two ways to add a medicine">
        <Steps
          items={[
            { title: "Scan a prescription", body: "Take a photo or upload one. We read the medicine name, dose, and times and fill in the form for you." },
            { title: "Check everything", body: "Review what we read before saving | nothing is added until you confirm." },
            { title: "Or enter manually", body: "Type the name, dose, and times yourself. Pick presets like Morning and Bedtime, or set custom times." },
            { title: "Choose who it's for", body: "Add the medicine for yourself or anyone in your Family Circle." },
          ]}
        />
      </DocSection>

      <Callout tone="tip" title="Prescription photos stay private">
        Photos are stored privately and can only be opened by you or, when you link them to a
        medicine, members of your Family Circle.
      </Callout>

      <TryItNow to="/reminders" label="Open Medication" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "What photo formats work?", a: "JPG, PNG, or a clear photo from your phone camera, up to 10 MB." },
            { q: "What if the scan gets something wrong?", a: "Nothing saves automatically, you always review and edit the details first." },
            { q: "Can I mark a dose as taken?", a: "Yes, each due dose has Taken and Skip buttons, so there's a simple log of what happened." },
            { q: "Is this medical advice?", a: "No. SomeoneNear reminds you of the schedule you enter; always follow your doctor's instructions." },
          ]}
        />
      </DocSection>
    </>
  );
}
