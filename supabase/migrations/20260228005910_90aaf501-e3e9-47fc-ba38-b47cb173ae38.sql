-- Admin can view all modems
CREATE POLICY "Admin can view all modems"
  ON public.modems FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all chips
CREATE POLICY "Admin can view all chips"
  ON public.chips FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all sms_logs
CREATE POLICY "Admin can view all sms_logs"
  ON public.sms_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all locations
CREATE POLICY "Admin can view all locations"
  ON public.locations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));