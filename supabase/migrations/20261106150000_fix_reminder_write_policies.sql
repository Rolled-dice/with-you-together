-- Restore authenticated reminder mutations for the owner of a reminder.
-- The production database currently has only the read policy.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Create own reminders'
  ) THEN
    CREATE POLICY "Create own reminders"
      ON public.reminders FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid() AND for_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Update own reminders'
  ) THEN
    CREATE POLICY "Update own reminders"
      ON public.reminders FOR UPDATE TO authenticated
      USING (created_by = auth.uid() AND for_user_id = auth.uid())
      WITH CHECK (created_by = auth.uid() AND for_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Delete own reminders'
  ) THEN
    CREATE POLICY "Delete own reminders"
      ON public.reminders FOR DELETE TO authenticated
      USING (created_by = auth.uid() AND for_user_id = auth.uid());
  END IF;
END $$;
