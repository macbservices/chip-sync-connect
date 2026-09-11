
-- Security hardening (audit follow-up to 20260908183043):
--
-- 1. "Users can update own profile" had no WITH CHECK, so any authenticated
--    customer could PATCH their own profiles row directly (e.g. via the anon
--    key + their own JWT) and set balance_cents / referred_by_affiliate_id to
--    any value, granting themselves unlimited wallet balance or hijacking
--    affiliate commissions. All legitimate balance changes already happen in
--    SECURITY DEFINER functions (purchase_service, approve_recharge, etc.),
--    which run as the migration owner and are unaffected by this check.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND balance_cents = (SELECT p.balance_cents FROM public.profiles p WHERE p.id = profiles.id)
  AND referred_by_affiliate_id IS NOT DISTINCT FROM (SELECT p.referred_by_affiliate_id FROM public.profiles p WHERE p.id = profiles.id)
);

-- 2. "Customers can create orders" only checked customer_id, so a customer
--    could INSERT an order directly with status='active'/'completed', an
--    arbitrary chip_id, and any amount_cents — bypassing payment entirely.
--    The PIX checkout flow (OrderCheckout.tsx) always creates orders as
--    'pending_payment' with no chip assigned and the service's real price;
--    purchase_service() (wallet flow) bypasses RLS as a SECURITY DEFINER
--    function, so it is unaffected by this check.
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;

CREATE POLICY "Customers can create orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND status = 'pending_payment'
  AND chip_id IS NULL
  AND amount_cents = (
    SELECT s.price_cents FROM public.services s
    WHERE s.id = orders.service_id AND s.is_active = true
  )
);
