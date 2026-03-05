
-- Function to link a new user to their affiliate referrer (called after signup)
CREATE OR REPLACE FUNCTION public.link_referral(_referral_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _affiliate_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id INTO _affiliate_id FROM affiliates WHERE referral_code = _referral_code AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  -- Don't allow self-referral
  IF EXISTS (SELECT 1 FROM affiliates WHERE id = _affiliate_id AND user_id = _user_id) THEN RETURN; END IF;

  -- Only link if not already referred
  UPDATE profiles SET referred_by_affiliate_id = _affiliate_id, updated_at = now()
    WHERE user_id = _user_id AND referred_by_affiliate_id IS NULL;
END;
$$;

-- Affiliate withdrawal request function
CREATE OR REPLACE FUNCTION public.affiliate_withdraw(_amount_cents integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _affiliate affiliates%ROWTYPE;
  _request_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _affiliate FROM affiliates WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not an affiliate'; END IF;
  IF _affiliate.balance_cents < _amount_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  UPDATE affiliates SET balance_cents = balance_cents - _amount_cents, updated_at = now()
    WHERE id = _affiliate.id;

  INSERT INTO withdrawal_requests (user_id, amount_cents, status)
    VALUES (_user_id, _amount_cents, 'pending')
    RETURNING id INTO _request_id;

  RETURN _request_id;
END;
$$;
