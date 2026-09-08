-- Revert definer view; use column-level grants for anonymous browsing instead
ALTER VIEW public.public_services SET (security_invoker = true);

DROP POLICY IF EXISTS "Authenticated users can view active services" ON public.services;

CREATE POLICY "Anyone can view active services"
  ON public.services FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

REVOKE SELECT ON public.services FROM anon;
GRANT SELECT (id, name, description, type, price_cents, duration_minutes, is_active, created_at, updated_at)
  ON public.services TO anon;

-- Trigger + internal SECURITY DEFINER functions should not be callable from the API
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (p.prorettype = 'trigger'::regtype
           OR p.proname IN ('auto_cancel_stale_orders'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Ensure no anon execute remains on any public SECURITY DEFINER function
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;
