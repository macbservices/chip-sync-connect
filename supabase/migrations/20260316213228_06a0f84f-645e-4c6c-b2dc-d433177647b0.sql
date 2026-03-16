
-- Remove the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can download app" ON storage.objects;

-- Create restricted SELECT policy for collaborators and admins only
CREATE POLICY "Collaborators and admins can download app" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'app-downloads' AND (
    public.has_role(auth.uid(), 'collaborator'::public.app_role) OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Make bucket private so public URL doesn't bypass RLS
UPDATE storage.buckets SET public = false WHERE id = 'app-downloads';
