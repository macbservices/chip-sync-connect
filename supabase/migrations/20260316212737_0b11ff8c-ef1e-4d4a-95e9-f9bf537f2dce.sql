
-- Create public bucket for app downloads
INSERT INTO storage.buckets (id, name, public) VALUES ('app-downloads', 'app-downloads', true);

-- Allow admin to upload/update/delete files
CREATE POLICY "Admin can upload app files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin can update app files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin can delete app files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow authenticated users to download
CREATE POLICY "Authenticated users can download app" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-downloads');
