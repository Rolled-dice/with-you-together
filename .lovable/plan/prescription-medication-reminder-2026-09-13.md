# Prescription & Medication Reminder

## Goal
Turn the existing Reminders area into an accessible two-part experience: medication setup and everyday reminders. Reuse the current secure medication, schedule, dose-log, prescription storage, and AI-reading support.

## Experience
- Add a clear top-level choice between **Medication** and **Everyday reminder**.
- Medication setup opens as one calm, guided panel with a prominent **Scan prescription** / **Enter manually** segmented switch.
- Scan mode supports drag-and-drop, file browsing, and mobile camera capture, with image preview, replace/remove controls, upload progress, and a clear review-before-save step.
- Manual mode captures who the medicine is for, medicine name, dosage, form, optional instructions, and a conversational frequency choice.
- Reminder times use large preset choices such as Morning, Afternoon, Evening, and Bedtime, plus custom time fields and a With food option.
- Show existing medicines and today’s doses below setup, with gentle Taken / Skip actions and a calm empty state.
- Preserve the current general reminder creator and reminder list in the Everyday reminder view.

## Accessibility and visual design
- Use the established sand, clay, ink, sage, and sky semantic tokens with no photographic assets.
- Keep body copy at 16px or larger in the new flow, strong contrast, visible labels, keyboard focus states, and 44px minimum primary controls.
- Use soft dashed upload borders, simple line icons, generous spacing, restrained transitions, and reduced-motion support.
- Announce upload/parsing/save progress and errors without alarming language.

## Functional work
- Add the medication onboarding interface and supporting focused React components.
- Wire prescription uploads to the private prescriptions bucket, then pass the stored path to the existing AI extraction function.
- Validate accepted image types and size before upload; keep every saved medication editable in the form before confirmation.
- Submit medication and schedule data through the existing authenticated server functions, refresh medicine/today views, and keep actions scoped by existing family access rules.
- Improve the AI result validation and user-facing gateway errors needed by this flow without changing unrelated AI features.
- Add the medication destination to the authenticated navigation without creating a duplicate route.

## Verification
- Check desktop and mobile layouts, keyboard-accessible switching, manual save, image selection/review, loading and error states, and today’s dose actions.
- Run focused type/tests and confirm the preview build is healthy.
