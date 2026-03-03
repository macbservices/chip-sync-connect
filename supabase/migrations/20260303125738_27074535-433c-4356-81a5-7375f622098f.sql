
-- Update RLS policy to allow customers to view SMS for completed orders too
DROP POLICY IF EXISTS "Customers can view sms of their order chips" ON public.sms_logs;

CREATE POLICY "Customers can view sms of their order chips"
  ON public.sms_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.chip_id = sms_logs.chip_id
        AND orders.customer_id = auth.uid()
        AND orders.status IN ('active', 'paid', 'completed')
    )
  );
