
-- Trigger: when an incoming SMS is inserted for a chip with an active order,
-- automatically mark that order as completed
CREATE OR REPLACE FUNCTION public.complete_order_on_sms()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _order RECORD;
BEGIN
  -- Only for incoming SMS
  IF NEW.direction <> 'incoming' THEN
    RETURN NEW;
  END IF;

  -- Find the active order for this chip where SMS arrived after order creation
  SELECT id INTO _order
  FROM orders
  WHERE chip_id = NEW.chip_id
    AND status IN ('active', 'paid')
    AND NEW.received_at >= created_at
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE orders
    SET status = 'completed', updated_at = now()
    WHERE id = _order.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complete_order_on_sms
  AFTER INSERT ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_order_on_sms();
