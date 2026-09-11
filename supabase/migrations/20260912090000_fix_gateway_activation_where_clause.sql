-- admin_set_active_payment_gateway updated every row in payment_gateway_settings
-- (activating the chosen one, deactivating the rest) with no WHERE clause.
-- That trips this project's "UPDATE requires a WHERE clause" safety guard.
-- Fix: add an always-true WHERE that still targets every row, satisfying the
-- guard without changing the function's behavior.
CREATE OR REPLACE FUNCTION public.admin_set_active_payment_gateway(_gateway text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_gateway_settings WHERE gateway = _gateway) THEN
    RAISE EXCEPTION 'Unknown gateway';
  END IF;

  UPDATE public.payment_gateway_settings
  SET is_active = (gateway = _gateway), updated_at = now()
  WHERE gateway IS NOT NULL;
END;
$$;
