
-- Fix: recreate the view without SECURITY DEFINER (plain view respects caller's RLS)
DROP VIEW IF EXISTS public.weekly_sales_report;

CREATE VIEW public.weekly_sales_report
WITH (security_invoker = true)
AS
SELECT
  l.user_id AS collaborator_id,
  l.name AS location_name,
  o.service_id,
  s.name AS service_name,
  s.type AS service_type,
  COUNT(o.id) AS total_orders,
  SUM(o.amount_cents) AS total_revenue_cents,
  ROUND(SUM(o.amount_cents) * 0.40) AS commission_cents,
  date_trunc('week', o.created_at) AS week_start
FROM orders o
JOIN chips c ON c.id = o.chip_id
JOIN modems m ON m.id = c.modem_id
JOIN locations l ON l.id = m.location_id
JOIN services s ON s.id = o.service_id
WHERE o.status IN ('active', 'completed')
GROUP BY l.user_id, l.name, o.service_id, s.name, s.type, date_trunc('week', o.created_at)
ORDER BY week_start DESC, total_revenue_cents DESC;
