
-- Function to cancel an active order, refund balance, and free the chip
CREATE OR REPLACE FUNCTION public.admin_cancel_order_return_chip(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order orders%ROWTYPE;
  _service_type text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _order FROM orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _order.status NOT IN ('active', 'pending_payment') THEN
    RAISE EXCEPTION 'Order not cancellable';
  END IF;

  -- Get service type for chip activation rollback
  SELECT type INTO _service_type FROM services WHERE id = _order.service_id;

  -- Cancel the order
  UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = _order_id;

  -- Refund balance
  UPDATE profiles SET balance_cents = balance_cents + _order.amount_cents, updated_at = now()
    WHERE user_id = _order.customer_id;

  -- Rollback chip activation count if chip was assigned
  IF _order.chip_id IS NOT NULL AND _service_type IS NOT NULL THEN
    UPDATE chip_activations
    SET activation_count = GREATEST(activation_count - 1, 0),
        is_exhausted = false,
        updated_at = now()
    WHERE chip_id = _order.chip_id AND service_type = _service_type;
  END IF;
END;
$$;

-- Function to auto-cancel active orders that haven't received SMS within 10 minutes
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order RECORD;
  _service_type text;
  _has_sms boolean;
  _cancelled_count integer := 0;
BEGIN
  FOR _order IN
    SELECT o.* FROM orders o
    WHERE o.status = 'active'
      AND o.chip_id IS NOT NULL
      AND o.created_at < now() - interval '10 minutes'
  LOOP
    -- Check if any SMS was received for this chip after the order was created
    SELECT EXISTS (
      SELECT 1 FROM sms_logs
      WHERE chip_id = _order.chip_id
        AND direction = 'incoming'
        AND received_at >= _order.created_at
    ) INTO _has_sms;

    IF NOT _has_sms THEN
      SELECT type INTO _service_type FROM services WHERE id = _order.service_id;

      UPDATE orders SET status = 'cancelled', admin_notes = 'Auto-cancelado: SMS não recebido em 10min', updated_at = now()
        WHERE id = _order.id;

      UPDATE profiles SET balance_cents = balance_cents + _order.amount_cents, updated_at = now()
        WHERE user_id = _order.customer_id;

      IF _service_type IS NOT NULL THEN
        UPDATE chip_activations
        SET activation_count = GREATEST(activation_count - 1, 0),
            is_exhausted = false,
            updated_at = now()
        WHERE chip_id = _order.chip_id AND service_type = _service_type;
      END IF;

      _cancelled_count := _cancelled_count + 1;
    END IF;
  END LOOP;

  RETURN _cancelled_count;
END;
$$;
