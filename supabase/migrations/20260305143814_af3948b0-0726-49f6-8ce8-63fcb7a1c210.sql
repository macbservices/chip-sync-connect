
-- Also credit affiliate when a collaborator's chip completes an order
-- This trigger fires when an order status changes to 'completed'
CREATE OR REPLACE FUNCTION public.credit_affiliate_on_collaborator_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _chip_owner_id uuid;
  _affiliate_id uuid;
  _commission integer;
BEGIN
  -- Only when order becomes completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.chip_id IS NOT NULL THEN
    -- Find the collaborator (chip owner)
    SELECT l.user_id INTO _chip_owner_id
    FROM chips c
    JOIN modems m ON m.id = c.modem_id
    JOIN locations l ON l.id = m.location_id
    WHERE c.id = NEW.chip_id;

    IF _chip_owner_id IS NOT NULL THEN
      -- Check if collaborator was referred by an affiliate
      SELECT a.id INTO _affiliate_id
      FROM affiliates a
      JOIN profiles p ON p.referred_by_affiliate_id = a.id
      WHERE p.user_id = _chip_owner_id
        AND a.is_active = true;

      IF _affiliate_id IS NOT NULL THEN
        _commission := FLOOR(NEW.amount_cents * 0.20);
        IF _commission > 0 THEN
          -- Check if commission already credited for this order+affiliate (avoid duplicates)
          IF NOT EXISTS (
            SELECT 1 FROM affiliate_commissions
            WHERE affiliate_id = _affiliate_id AND order_id = NEW.id AND commission_type = 'collaborator_sale'
          ) THEN
            UPDATE affiliates SET balance_cents = balance_cents + _commission, updated_at = now()
              WHERE id = _affiliate_id;
            INSERT INTO affiliate_commissions (affiliate_id, order_id, referred_user_id, amount_cents, commission_type)
              VALUES (_affiliate_id, NEW.id, _chip_owner_id, _commission, 'collaborator_sale');
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_affiliate_collaborator_sale
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION credit_affiliate_on_collaborator_sale();
