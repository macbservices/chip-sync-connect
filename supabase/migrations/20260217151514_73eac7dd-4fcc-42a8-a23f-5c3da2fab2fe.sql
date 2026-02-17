
-- Tabela de serviços oferecidos pelo dono da chipeira
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('verification', 'rental')),
  price_cents integer NOT NULL DEFAULT 0,
  duration_minutes integer, -- para aluguel: duração em minutos
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ver serviços ativos (página pública)
CREATE POLICY "Anyone can view active services"
ON public.services FOR SELECT
USING (is_active = true);

-- Dono pode gerenciar seus serviços
CREATE POLICY "Owner can insert services"
ON public.services FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update services"
ON public.services FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete services"
ON public.services FOR DELETE
USING (auth.uid() = user_id);

-- Tabela de pedidos dos clientes
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'active', 'completed', 'cancelled')),
  chip_id uuid REFERENCES public.chips(id),
  phone_number text,
  pix_proof_url text,
  admin_notes text,
  amount_cents integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Cliente pode ver seus próprios pedidos
CREATE POLICY "Customers can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = customer_id);

-- Cliente pode criar pedidos
CREATE POLICY "Customers can create orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- Cliente pode atualizar seus pedidos (enviar comprovante)
CREATE POLICY "Customers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = customer_id);

-- Dono do serviço pode ver pedidos dos seus serviços
CREATE POLICY "Service owner can view orders"
ON public.orders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.services
  WHERE services.id = orders.service_id
  AND services.user_id = auth.uid()
));

-- Dono do serviço pode atualizar pedidos (aprovar pagamento)
CREATE POLICY "Service owner can update orders"
ON public.orders FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.services
  WHERE services.id = orders.service_id
  AND services.user_id = auth.uid()
));

-- Triggers de updated_at
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket para comprovantes PIX
INSERT INTO storage.buckets (id, name, public) VALUES ('pix-proofs', 'pix-proofs', false);

CREATE POLICY "Users can upload pix proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pix-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own pix proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pix-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service owners can view proofs for their orders
CREATE POLICY "Service owners can view pix proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pix-proofs');
