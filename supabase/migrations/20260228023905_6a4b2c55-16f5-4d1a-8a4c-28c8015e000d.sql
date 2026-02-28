
-- Fix locations RLS: change all RESTRICTIVE policies to PERMISSIVE
DROP POLICY IF EXISTS "Admin can view all locations" ON public.locations;
DROP POLICY IF EXISTS "Users can create own locations" ON public.locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON public.locations;
DROP POLICY IF EXISTS "Users can update own locations" ON public.locations;
DROP POLICY IF EXISTS "Users can view own locations" ON public.locations;

CREATE POLICY "Admin can view all locations" ON public.locations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own locations" ON public.locations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own locations" ON public.locations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own locations" ON public.locations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update handle_new_user to read role from user metadata (only customer or collaborator allowed)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  -- Only allow customer or collaborator from signup
  IF _role NOT IN ('customer', 'collaborator') THEN
    _role := 'customer';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
