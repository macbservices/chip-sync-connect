ALTER TABLE public.payment_gateway_settings
  ADD COLUMN IF NOT EXISTS credential_schema jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.recharge_requests
  ADD COLUMN IF NOT EXISTS external_reference text;

CREATE INDEX IF NOT EXISTS recharge_requests_external_reference_idx
  ON public.recharge_requests (external_reference)
  WHERE external_reference IS NOT NULL;

UPDATE public.payment_gateway_settings
SET credential_schema = '[
  {"key": "client_id", "label": "Client ID", "type": "password"},
  {"key": "client_secret", "label": "Client Secret", "type": "password"},
  {"key": "certificate", "label": "Certificado (PEM, cert + chave privada)", "type": "textarea"},
  {"key": "pix_key", "label": "Chave PIX", "type": "password"}
]'::jsonb
WHERE gateway = 'efi';

INSERT INTO public.payment_gateway_settings (gateway, label, is_active, credentials, credential_schema)
VALUES
  ('mercadopago', 'Mercado Pago', false, '{}'::jsonb, '[
    {"key": "access_token", "label": "Access Token", "type": "password"},
    {"key": "public_key", "label": "Public Key", "type": "password"},
    {"key": "webhook_secret", "label": "Webhook Secret", "type": "password"}
  ]'::jsonb),
  ('asaas', 'Asaas', false, '{}'::jsonb, '[
    {"key": "api_key", "label": "API Key", "type": "password"},
    {"key": "environment", "label": "Ambiente (sandbox ou production)", "type": "text"},
    {"key": "webhook_token", "label": "Token do Webhook", "type": "password"}
  ]'::jsonb),
  ('stripe', 'Stripe', false, '{}'::jsonb, '[
    {"key": "secret_key", "label": "Secret Key", "type": "password"},
    {"key": "publishable_key", "label": "Publishable Key", "type": "password"},
    {"key": "webhook_secret", "label": "Webhook Signing Secret", "type": "password"}
  ]'::jsonb),
  ('pagbank', 'PagBank', false, '{}'::jsonb, '[
    {"key": "token", "label": "Token de Integração", "type": "password"},
    {"key": "email", "label": "E-mail da conta PagBank", "type": "text"}
  ]'::jsonb),
  ('picpay', 'PicPay', false, '{}'::jsonb, '[
    {"key": "x_picpay_token", "label": "Token PicPay (x-picpay-token)", "type": "password"},
    {"key": "x_seller_token", "label": "Seller Token (recebido nos callbacks)", "type": "password"}
  ]'::jsonb),
  ('pix_manual', 'PIX Manual / Direto', false, '{}'::jsonb, '[
    {"key": "pix_key", "label": "Chave PIX", "type": "text"},
    {"key": "pix_key_type", "label": "Tipo da chave (CPF, CNPJ, e-mail, telefone ou aleatória)", "type": "text"},
    {"key": "holder_name", "label": "Nome do titular", "type": "text"},
    {"key": "holder_city", "label": "Cidade do titular", "type": "text"}
  ]'::jsonb)
ON CONFLICT (gateway) DO NOTHING;

UPDATE public.payment_gateway_settings SET is_active = (gateway = 'efi');

DROP FUNCTION IF EXISTS public.admin_list_payment_gateways();

CREATE FUNCTION public.admin_list_payment_gateways()
RETURNS TABLE(
  gateway text,
  label text,
  is_active boolean,
  credential_schema jsonb,
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
    s.credential_schema,
    COALESCE((
      SELECT jsonb_object_agg(f->>'key', COALESCE(s.credentials->>(f->>'key'), '') <> '')
      FROM jsonb_array_elements(s.credential_schema) f
    ), '{}'::jsonb) AS configured_fields,
    s.updated_at
  FROM public.payment_gateway_settings s
  ORDER BY s.gateway;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_payment_gateways() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_payment_gateways() TO authenticated;