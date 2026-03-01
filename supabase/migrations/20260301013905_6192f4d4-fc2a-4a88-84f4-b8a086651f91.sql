
CREATE OR REPLACE FUNCTION public.delete_location_cascade(_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _modem_ids uuid[];
  _chip_ids uuid[];
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM locations WHERE id = _location_id AND (user_id = _user_id OR has_role(_user_id, 'admin'))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT array_agg(id) INTO _modem_ids FROM modems WHERE location_id = _location_id;

  IF _modem_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO _chip_ids FROM chips WHERE modem_id = ANY(_modem_ids);

    IF _chip_ids IS NOT NULL THEN
      -- Nullify chip references in orders
      UPDATE orders SET chip_id = NULL WHERE chip_id = ANY(_chip_ids);
      DELETE FROM chip_activations WHERE chip_id = ANY(_chip_ids);
      DELETE FROM sms_logs WHERE chip_id = ANY(_chip_ids);
      DELETE FROM chips WHERE id = ANY(_chip_ids);
    END IF;

    DELETE FROM modems WHERE id = ANY(_modem_ids);
  END IF;

  DELETE FROM locations WHERE id = _location_id;
END;
$function$;
