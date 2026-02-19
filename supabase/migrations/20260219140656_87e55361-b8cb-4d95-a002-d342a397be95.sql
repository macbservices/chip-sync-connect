
-- Add activation count tracking per chip per service type
-- This tracks how many times each chip has been used per service type
CREATE TABLE IF NOT EXISTS public.chip_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  activation_count integer NOT NULL DEFAULT 0,
  max_activations integer NOT NULL DEFAULT 5,
  is_exhausted boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(chip_id, service_type)
);

ALTER TABLE public.chip_activations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin can manage chip_activations"
ON public.chip_activations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Collaborators can view activations for their own chips
CREATE POLICY "Collaborators can view own chip activations"
ON public.chip_activations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chips c
    JOIN modems m ON m.id = c.modem_id
    JOIN locations l ON l.id = m.location_id
    WHERE c.id = chip_activations.chip_id AND l.user_id = auth.uid()
  )
);

-- Add a weekly_sales_view for collaborator commission reports
CREATE OR REPLACE VIEW public.weekly_sales_report AS
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
