CREATE POLICY "Dashboard can read visual exports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'visual-exports');

CREATE POLICY "Dashboard can create visual exports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visual-exports');

CREATE POLICY "Dashboard can update visual exports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'visual-exports')
WITH CHECK (bucket_id = 'visual-exports');

CREATE POLICY "Dashboard can delete visual exports"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'visual-exports');