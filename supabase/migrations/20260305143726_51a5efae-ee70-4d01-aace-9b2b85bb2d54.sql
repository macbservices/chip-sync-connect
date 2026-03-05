
-- Create affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  referral_code text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  balance_cents integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create affiliate_commissions table
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  referred_user_id uuid NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'sale',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add referred_by_affiliate_id to profiles
ALTER TABLE public.profiles ADD COLUMN referred_by_affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- RLS for affiliates
CREATE POLICY "Admin can manage affiliates" ON public.affiliates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Affiliates can view own record" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Affiliates can update own record" ON public.affiliates FOR UPDATE USING (auth.uid() = user_id);

-- RLS for affiliate_commissions
CREATE POLICY "Admin can view all commissions" ON public.affiliate_commissions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Affiliates can view own commissions" ON public.affiliate_commissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_commissions.affiliate_id AND user_id = auth.uid())
);

-- Updated_at trigger for affiliates
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
