
-- =========================================================
-- CARE HUB: Medications, Schedules, Dose Logs, Reminders
-- =========================================================

-- Helper: is the caller in the same family as _for_user?
CREATE OR REPLACE FUNCTION public.same_family_as(_for_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = _for_user
  );
$$;

-- Helper: is caller an adult/owner in the same family as _for_user?
CREATE OR REPLACE FUNCTION public.is_family_adult_of(_for_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = _for_user
      AND fm1.role IN ('owner','adult')
  );
$$;

-- ---------- medications ----------
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_user_id uuid NOT NULL,                -- who the medication is for
  added_by uuid NOT NULL,                    -- who added it
  name text NOT NULL,
  dosage text,                               -- e.g. "500 mg"
  form text,                                 -- tablet, syrup, injection, drops
  instructions text,                         -- "after food", "before sleep"
  prescribed_by text,                        -- doctor name
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  refill_date date,
  prescription_image_path text,              -- storage path in "prescriptions" bucket
  parsed_data jsonb,                         -- raw AI extraction for reference
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View meds within family"
  ON public.medications FOR SELECT TO authenticated
  USING (public.same_family_as(for_user_id) OR for_user_id = auth.uid());

CREATE POLICY "Adults add meds for family"
  ON public.medications FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND (public.is_family_adult_of(for_user_id) OR for_user_id = auth.uid())
  );

CREATE POLICY "Adults update meds for family"
  ON public.medications FOR UPDATE TO authenticated
  USING (public.is_family_adult_of(for_user_id) OR for_user_id = auth.uid())
  WITH CHECK (public.is_family_adult_of(for_user_id) OR for_user_id = auth.uid());

CREATE POLICY "Adults delete meds for family"
  ON public.medications FOR DELETE TO authenticated
  USING (public.is_family_adult_of(for_user_id) OR for_user_id = auth.uid());

CREATE TRIGGER medications_set_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_medications_for_user ON public.medications(for_user_id);
CREATE INDEX idx_medications_active ON public.medications(for_user_id, is_active);

-- ---------- medication_schedules ----------
CREATE TABLE public.medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  time_of_day time NOT NULL,                     -- 09:00, 14:00, 21:00
  days_of_week smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun..6=Sat
  with_food boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_schedules TO authenticated;
GRANT ALL ON public.medication_schedules TO service_role;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View schedules via medication"
  ON public.medication_schedules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medications m
    WHERE m.id = medication_id
      AND (public.same_family_as(m.for_user_id) OR m.for_user_id = auth.uid())
  ));

CREATE POLICY "Manage schedules via medication"
  ON public.medication_schedules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medications m
    WHERE m.id = medication_id
      AND (public.is_family_adult_of(m.for_user_id) OR m.for_user_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medications m
    WHERE m.id = medication_id
      AND (public.is_family_adult_of(m.for_user_id) OR m.for_user_id = auth.uid())
  ));

CREATE INDEX idx_schedules_med ON public.medication_schedules(medication_id);

-- ---------- dose_logs ----------
CREATE TABLE public.dose_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
  for_user_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','taken','skipped','missed')),
  logged_at timestamptz,
  logged_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_logs TO authenticated;
GRANT ALL ON public.dose_logs TO service_role;
ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View dose logs in family"
  ON public.dose_logs FOR SELECT TO authenticated
  USING (public.same_family_as(for_user_id) OR for_user_id = auth.uid());

CREATE POLICY "Insert dose logs in family"
  ON public.dose_logs FOR INSERT TO authenticated
  WITH CHECK (public.same_family_as(for_user_id) OR for_user_id = auth.uid());

CREATE POLICY "Update dose logs in family"
  ON public.dose_logs FOR UPDATE TO authenticated
  USING (public.same_family_as(for_user_id) OR for_user_id = auth.uid())
  WITH CHECK (public.same_family_as(for_user_id) OR for_user_id = auth.uid());

CREATE INDEX idx_dose_logs_user_date ON public.dose_logs(for_user_id, scheduled_at);
CREATE INDEX idx_dose_logs_status ON public.dose_logs(status, scheduled_at);

-- ---------- reminders (general: appointments, bills, water, etc.) ----------
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','appointment','bill','hydration','exercise','birthday','other')),
  due_at timestamptz NOT NULL,
  recurrence text CHECK (recurrence IN ('none','daily','weekly','monthly','yearly')) DEFAULT 'none',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','snoozed','dismissed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reminders in family"
  ON public.reminders FOR SELECT TO authenticated
  USING (public.same_family_as(for_user_id) OR for_user_id = auth.uid());

CREATE POLICY "Create reminders in family"
  ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.same_family_as(for_user_id) OR for_user_id = auth.uid())
  );

CREATE POLICY "Update reminders in family"
  ON public.reminders FOR UPDATE TO authenticated
  USING (public.same_family_as(for_user_id) OR for_user_id = auth.uid())
  WITH CHECK (public.same_family_as(for_user_id) OR for_user_id = auth.uid());

CREATE POLICY "Delete reminders in family"
  ON public.reminders FOR DELETE TO authenticated
  USING (public.is_family_adult_of(for_user_id) OR for_user_id = auth.uid());

CREATE TRIGGER reminders_set_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reminders_user_due ON public.reminders(for_user_id, due_at);
CREATE INDEX idx_reminders_status ON public.reminders(status, due_at);
