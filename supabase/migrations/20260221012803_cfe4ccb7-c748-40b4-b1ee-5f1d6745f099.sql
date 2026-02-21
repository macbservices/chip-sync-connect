
-- 1. Server-side function for approving recharges (fixes admin_balance_update)
CREATE OR REPLACE FUNCTION public.approve_recharge(_recharge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recharge recharge_requests%ROWTYPE;
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _recharge FROM recharge_requests WHERE id = _recharge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recharge not found'; END IF;
  IF _recharge.status <> 'pending' THEN RAISE EXCEPTION 'Recharge already processed'; END IF;

  UPDATE recharge_requests SET status = 'approved', updated_at = now() WHERE id = _recharge_id;
  UPDATE profiles SET balance_cents = balance_cents + _recharge.amount_cents, updated_at = now()
    WHERE user_id = _recharge.user_id;
END;
$$;

-- 2. Server-side function for cancelling orders with refund
CREATE OR REPLACE FUNCTION public.cancel_order_refund(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order orders%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _order FROM orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _order.status = 'cancelled' THEN RAISE EXCEPTION 'Order already cancelled'; END IF;

  UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = _order_id;
  UPDATE profiles SET balance_cents = balance_cents + _order.amount_cents, updated_at = now()
    WHERE user_id = _order.customer_id;
END;
$$;

-- 3. Server-side function for purchasing a service (fixes client-side balance deduction in Store.tsx)
CREATE OR REPLACE FUNCTION public.purchase_service(_service_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _service services%ROWTYPE;
  _balance integer;
  _order_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _service FROM services WHERE id = _service_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found or inactive'; END IF;

  SELECT balance_cents INTO _balance FROM profiles WHERE user_id = _user_id FOR UPDATE;
  IF _balance < _service.price_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE profiles SET balance_cents = balance_cents - _service.price_cents, updated_at = now()
    WHERE user_id = _user_id;

  INSERT INTO orders (customer_id, service_id, amount_cents, status)
    VALUES (_user_id, _service_id, _service.price_cents, 'pending_payment')
    RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$$;

-- 4. Create public_services view to hide user_id (fixes services_user_id)
CREATE OR REPLACE VIEW public.public_services
WITH (security_invoker = true)
AS SELECT id, name, description, type, price_cents, duration_minutes, is_active
FROM services WHERE is_active = true;

-- 5. Admin can view all profiles (for legitimate admin operations)
CREATE POLICY "Admin can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));
