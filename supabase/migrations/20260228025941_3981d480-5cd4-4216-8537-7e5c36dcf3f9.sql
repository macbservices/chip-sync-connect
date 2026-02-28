
-- Withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_proof_url TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Collaborators can view their own withdrawal requests
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Collaborators can create their own withdrawal requests
CREATE POLICY "Users can create own withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all withdrawal requests
CREATE POLICY "Admin can view all withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admin can update withdrawal requests
CREATE POLICY "Admin can update withdrawals" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;

-- Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment proofs
CREATE POLICY "Admin can upload payment proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs');
