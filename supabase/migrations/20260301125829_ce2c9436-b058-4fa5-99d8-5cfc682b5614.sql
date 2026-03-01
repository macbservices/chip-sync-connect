-- 1. Add RLS-like protection to weekly_sales_report view
ALTER VIEW public.weekly_sales_report SET (security_invoker = on);

-- 2. Restrict services table: only authenticated users can view active services
-- (public_services view already handles public/unauthenticated access without user_id)
DROP POLICY IF EXISTS "Anyone can view active services" ON services;

CREATE POLICY "Authenticated users can view active services"
  ON services FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- 3. Ensure the detect_sms_fraud trigger exists on sms_logs
DROP TRIGGER IF EXISTS trg_detect_sms_fraud ON sms_logs;
CREATE TRIGGER trg_detect_sms_fraud
  AFTER INSERT ON sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION detect_sms_fraud();