
-- 1. Update default max_activations to 1 (new entries)
ALTER TABLE chip_activations ALTER COLUMN max_activations SET DEFAULT 1;

-- 2. Update all existing chip_activations to max 1 and mark exhausted if already used
UPDATE chip_activations SET max_activations = 1, is_exhausted = (activation_count >= 1);

-- 3. Recreate purchase_service with random chip selection and 1-use limit
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

  -- Find an available chip RANDOMLY, excluding chips already used for this service type
  SELECT c.id AS chip_id, c.phone_number
  INTO _chip
  FROM chips c
  JOIN modems m ON m.id = c.modem_id
  JOIN locations l ON l.id = m.location_id
  WHERE c.status = 'active'
    AND m.status = 'online'
    AND l.is_active = true
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
    VALUES (_chip.chip_id, _service.type, 1, 1, true)
    ON CONFLICT (chip_id, service_type)
    DO UPDATE SET
      activation_count = chip_activations.activation_count + 1,
      is_exhausted = true,
      updated_at = now();

  RETURN _order_id;
END;
$function$;
