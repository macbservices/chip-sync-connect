
CREATE OR REPLACE FUNCTION public.purchase_service(_service_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _service services%ROWTYPE;
  _balance integer;
  _order_id uuid;
  _chip RECORD;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _service FROM services WHERE id = _service_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found or inactive'; END IF;

  SELECT balance_cents INTO _balance FROM profiles WHERE user_id = _user_id FOR UPDATE;
  IF _balance < _service.price_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- Find an available chip that is not exhausted for this service type
  -- AND does not have any currently active order (prevents cross-service SMS leaking)
  SELECT c.id AS chip_id, c.phone_number
  INTO _chip
  FROM chips c
  JOIN modems m ON m.id = c.modem_id
  JOIN locations l ON l.id = m.location_id
  WHERE c.status = 'active'
    AND m.status = 'online'
    AND l.is_active = true
    AND l.user_id = _service.user_id
    AND NOT EXISTS (
      SELECT 1 FROM chip_activations ca
      WHERE ca.chip_id = c.id
        AND ca.service_type = _service.type
        AND ca.is_exhausted = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.chip_id = c.id
        AND o.status IN ('active', 'paid')
    )
  ORDER BY (
    SELECT COALESCE(ca2.activation_count, 0)
    FROM chip_activations ca2
    WHERE ca2.chip_id = c.id AND ca2.service_type = _service.type
  ) ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No available chip for this service';
  END IF;

  -- Deduct balance
  UPDATE profiles SET balance_cents = balance_cents - _service.price_cents, updated_at = now()
    WHERE user_id = _user_id;

  -- Create order with chip assigned
  INSERT INTO orders (customer_id, service_id, amount_cents, status, chip_id, phone_number)
    VALUES (_user_id, _service_id, _service.price_cents, 'active', _chip.chip_id, _chip.phone_number)
    RETURNING id INTO _order_id;

  -- Increment activation count
  INSERT INTO chip_activations (chip_id, service_type, activation_count)
    VALUES (_chip.chip_id, _service.type, 1)
    ON CONFLICT (chip_id, service_type)
    DO UPDATE SET
      activation_count = chip_activations.activation_count + 1,
      is_exhausted = (chip_activations.activation_count + 1) >= chip_activations.max_activations,
      updated_at = now();

  RETURN _order_id;
END;
$function$;
