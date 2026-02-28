
-- Fix: location delete policy is RESTRICTIVE, making deletes silently fail.
-- Drop and recreate as PERMISSIVE.
DROP POLICY IF EXISTS "Users can delete own locations" ON public.locations;
CREATE POLICY "Users can delete own locations"
  ON public.locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
