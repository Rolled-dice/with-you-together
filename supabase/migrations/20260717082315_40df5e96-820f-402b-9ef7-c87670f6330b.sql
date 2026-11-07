
ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN care_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN care_status text NOT NULL DEFAULT 'active',
  ADD COLUMN care_since timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN pronouns text,
  ADD COLUMN care_intent text;
