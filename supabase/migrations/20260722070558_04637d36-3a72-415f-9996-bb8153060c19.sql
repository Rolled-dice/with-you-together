
CREATE POLICY "Family can read prescription images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.prescription_image_path = storage.objects.name
        AND (public.same_family_as(m.for_user_id) OR m.for_user_id = auth.uid())
    )
  );

CREATE POLICY "Users upload own prescriptions"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own prescriptions"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
