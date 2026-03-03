
-- Allow admin to delete orders
CREATE POLICY "Admin can delete orders"
ON public.orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to reset all chip activations (for testing)
CREATE OR REPLACE FUNCTION public.admin_reset_all_chip_activations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM chip_activations;
END;
$$;
