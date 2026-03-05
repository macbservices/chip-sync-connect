
-- Update purchase_service to credit affiliate commission (20% of order value)
CREATE OR REPLACE FUNCTION public.purchase_service(_service_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _service services%ROWTYPE;
  _balance integer;
  _order_id uuid;
  _chip RECORD;
  _total_service_types integer;
  _chip_used_types integer;
  _exhaustion_threshold numeric;
  _affiliate_id uuid;
  _commission integer;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _service FROM services WHERE id = _service_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found or inactive'; END IF;

  SELECT balance_cents INTO _balance FROM profiles WHERE user_id = _user_id FOR UPDATE;
  IF _balance < _service.price_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT COUNT(DISTINCT type) INTO _total_service_types FROM services WHERE is_active = true;

  -- Find available chip
  SELECT c.id AS chip_id, c.phone_number
  INTO _chip
  FROM chips c
  JOIN modems m ON m.id = c.modem_id
  JOIN locations l ON l.id = m.location_id
  WHERE c.status = 'active'
    AND l.is_active = true
    AND m.last_seen_at IS NOT NULL
    AND m.last_seen_at > now() - interval '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM chip_activations ca
      WHERE ca.chip_id = c.id
        AND ca.service_type = _service.type
        AND ca.activation_count >= 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.chip_id = c.id
        AND o.status IN ('active', 'paid')
    )
  ORDER BY random()
  LIMIT 1
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No available chip for this service';
  END IF;

  UPDATE profiles SET balance_cents = balance_cents - _service.price_cents, updated_at = now()
    WHERE user_id = _user_id;

  INSERT INTO orders (customer_id, service_id, amount_cents, status, chip_id, phone_number)
    VALUES (_user_id, _service_id, _service.price_cents, 'active', _chip.chip_id, _chip.phone_number)
    RETURNING id INTO _order_id;

  INSERT INTO chip_activations (chip_id, service_type, activation_count, max_activations, is_exhausted)
    VALUES (_chip.chip_id, _service.type, 1, 1, false)
    ON CONFLICT (chip_id, service_type)
    DO UPDATE SET
      activation_count = chip_activations.activation_count + 1,
      updated_at = now();

  SELECT COUNT(DISTINCT service_type) INTO _chip_used_types
    FROM chip_activations
    WHERE chip_id = _chip.chip_id AND activation_count >= 1;

  _exhaustion_threshold := _total_service_types * 0.7;

  IF _chip_used_types >= _exhaustion_threshold THEN
    UPDATE chip_activations
    SET is_exhausted = true, updated_at = now()
    WHERE chip_id = _chip.chip_id;

    UPDATE chips SET status = 'exhausted', updated_at = now()
    WHERE id = _chip.chip_id;
  END IF;

  -- Affiliate commission: 20% of order value
  SELECT a.id INTO _affiliate_id
  FROM affiliates a
  JOIN profiles p ON p.referred_by_affiliate_id = a.id
  WHERE p.user_id = _user_id
    AND a.is_active = true;

  IF _affiliate_id IS NOT NULL THEN
    _commission := FLOOR(_service.price_cents * 0.20);
    IF _commission > 0 THEN
      UPDATE affiliates SET balance_cents = balance_cents + _commission, updated_at = now()
        WHERE id = _affiliate_id;
      INSERT INTO affiliate_commissions (affiliate_id, order_id, referred_user_id, amount_cents, commission_type)
        VALUES (_affiliate_id, _order_id, _user_id, _commission, 'customer_purchase');
    END IF;
  END IF;

  RETURN _order_id;
END;
$$;
