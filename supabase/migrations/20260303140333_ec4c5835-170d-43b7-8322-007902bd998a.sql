
-- Allow collaborators to view orders linked to their chips (via chip -> modem -> location ownership)
CREATE POLICY "Chip owner can view orders"
ON public.orders
FOR SELECT
USING (
  chip_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM chips c
    JOIN modems m ON m.id = c.modem_id
    JOIN locations l ON l.id = m.location_id
    WHERE c.id = orders.chip_id AND l.user_id = auth.uid()
  )
);
