
-- Allow admin to delete recharge requests
CREATE POLICY "Admin can delete recharge requests"
ON public.recharge_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to delete withdrawal requests
CREATE POLICY "Admin can delete withdrawal requests"
ON public.withdrawal_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
