-- 1. Restrict pix-proofs storage reads to owner, related service owner, and admins
DROP POLICY IF EXISTS "Service owners can view pix proofs" ON storage.objects;

CREATE POLICY "Service owners can view related pix proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pix-proofs' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.services s ON s.id = o.service_id
      WHERE s.user_id = auth.uid()
        AND o.pix_proof_url = storage.objects.name
    )
  )
);

-- 2. Restrict payment-proofs reads to the owning user and admins
DROP POLICY IF EXISTS "Authenticated users can view payment proofs" ON storage.objects;

CREATE POLICY "Owners and admins can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.withdrawal_requests w
      WHERE w.user_id = auth.uid() AND w.payment_proof_url = storage.objects.name
    )
  )
);

-- 3. Customers must not be able to edit order status / admin_notes / fraud_alert.
-- All customer-side order changes go through SECURITY DEFINER RPCs (customer_cancel_order).
DROP POLICY IF EXISTS "Customers can update own orders" ON public.orders;

CREATE POLICY "Customers can attach pix proof to own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (
  auth.uid() = customer_id
  AND status = (SELECT o.status FROM public.orders o WHERE o.id = orders.id)
  AND admin_notes IS NOT DISTINCT FROM (SELECT o.admin_notes FROM public.orders o WHERE o.id = orders.id)
  AND fraud_alert IS NOT DISTINCT FROM (SELECT o.fraud_alert FROM public.orders o WHERE o.id = orders.id)
  AND amount_cents = (SELECT o.amount_cents FROM public.orders o WHERE o.id = orders.id)
);

-- 4. Public (anonymous) service browsing without exposing owner ids
ALTER VIEW public.public_services SET (security_invoker = false);
GRANT SELECT ON public.public_services TO anon, authenticated;

-- 5. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order_return_chip(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_reset_all_chip_activations() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_recharge(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_order_refund(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_orders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.affiliate_withdraw(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.customer_cancel_order(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_location_cascade(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.link_referral(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.purchase_service(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_cancel_order_return_chip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_chip_activations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_recharge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_refund(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_withdraw(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_location_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_service(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_cancel_stale_orders() TO service_role;
