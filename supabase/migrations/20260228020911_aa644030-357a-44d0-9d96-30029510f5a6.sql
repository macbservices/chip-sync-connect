
CREATE OR REPLACE FUNCTION public.customer_cancel_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _order orders%ROWTYPE;
  _service_type text;
  _has_sms boolean;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _order FROM orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Must be the owner
  IF _order.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your order';
  END IF;

  -- Must be active
  IF _order.status NOT IN ('active', 'pending_payment') THEN
    RAISE EXCEPTION 'Order not cancellable';
  END IF;

  -- Check if SMS was received - if yes, only admin can cancel
  IF _order.chip_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM sms_logs
      WHERE chip_id = _order.chip_id
        AND direction = 'incoming'
        AND received_at >= _order.created_at
    ) INTO _has_sms;

    IF _has_sms THEN
      RAISE EXCEPTION 'SMS already received. Only admin can cancel.';
    END IF;
  END IF;

  -- Get service type for chip activation rollback
  SELECT type INTO _service_type FROM services WHERE id = _order.service_id;

  -- Cancel
  UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = _order_id;

  -- Refund
  UPDATE profiles SET balance_cents = balance_cents + _order.amount_cents, updated_at = now()
    WHERE user_id = _order.customer_id;

  -- Rollback chip activation
  IF _order.chip_id IS NOT NULL AND _service_type IS NOT NULL THEN
    UPDATE chip_activations
    SET activation_count = GREATEST(activation_count - 1, 0),
        is_exhausted = false,
        updated_at = now()
    WHERE chip_id = _order.chip_id AND service_type = _service_type;
  END IF;
END;
$$;
