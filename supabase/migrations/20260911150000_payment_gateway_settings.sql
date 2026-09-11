-- Dynamic payment gateway configuration.
--
-- The table itself has RLS enabled with NO policies at all: nobody reaches it
-- directly through PostgREST (not even admins). All access goes through the
-- SECURITY DEFINER functions below (which check has_role(...,'admin') themselves)
-- or through an edge function's service-role client — the same trusted pattern
-- already used for profiles/orders/manage-users in this project.
CREATE TABLE public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_payment_gateway_settings_updated_at
BEFORE UPDATE ON public.payment_gateway_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the gateway already in production (Efí/PIX) as the active default with
-- empty credentials. efi-pix falls back to its existing EFI_* environment
-- variables whenever a field is empty here, so nothing breaks until an admin
-- actually fills in credentials through the new panel.
INSERT INTO public.payment_gateway_settings (gateway, label, is_active, credentials)
VALUES ('efi', 'Efí (PIX)', true, '{}'::jsonb)
ON CONFLICT (gateway) DO NOTHING;

-- Admin-only: list gateways with credentials redacted to booleans (never the
-- actual secret values) so the panel can show "configured" without ever
-- reading a secret back out to the browser.
CREATE OR REPLACE FUNCTION public.admin_list_payment_gateways()
RETURNS TABLE(
  gateway text,
  label text,
  is_active boolean,
  configured_fields jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    s.gateway,
    s.label,
    s.is_active,
    jsonb_build_object(
      'client_id', COALESCE(s.credentials->>'client_id', '') <> '',
      'client_secret', COALESCE(s.credentials->>'client_secret', '') <> '',
      'certificate', COALESCE(s.credentials->>'certificate', '') <> '',
      'pix_key', COALESCE(s.credentials->>'pix_key', '') <> ''
    ),
    s.updated_at
  FROM public.payment_gateway_settings s
  ORDER BY s.gateway;
END;
$$;

-- Admin-only: merge new credential values into a gateway's stored credentials.
-- Only keys present in _credentials are touched, so the panel can send just
-- the fields the admin actually typed and leave the rest untouched (blank
-- fields in the UI mean "keep current value").
CREATE OR REPLACE FUNCTION public.admin_set_payment_gateway_credentials(_gateway text, _credentials jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _gateway IS NULL OR length(_gateway) = 0 OR length(_gateway) > 40 THEN
    RAISE EXCEPTION 'Invalid gateway';
  END IF;
  IF _credentials IS NULL OR jsonb_typeof(_credentials) <> 'object' THEN
    RAISE EXCEPTION 'Invalid credentials payload';
  END IF;
  IF pg_column_size(_credentials) > 20000 THEN
    RAISE EXCEPTION 'Credentials payload too large';
  END IF;

  INSERT INTO public.payment_gateway_settings (gateway, label, credentials)
  VALUES (_gateway, _gateway, _credentials)
  ON CONFLICT (gateway) DO UPDATE
    SET credentials = public.payment_gateway_settings.credentials || excluded.credentials,
        updated_at = now();
END;
$$;

-- Admin-only: activate exactly one gateway at a time.
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

  UPDATE public.payment_gateway_settings SET is_active = (gateway = _gateway), updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_payment_gateways() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_payment_gateway_credentials(text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_active_payment_gateway(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_list_payment_gateways() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_gateway_credentials(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_active_payment_gateway(text) TO authenticated;
