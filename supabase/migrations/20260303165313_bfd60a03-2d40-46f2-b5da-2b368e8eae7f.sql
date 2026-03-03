CREATE OR REPLACE FUNCTION public.send_chip_exhausted_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _chip RECORD;
  _modem RECORD;
  _location RECORD;
  _collaborator_email text;
BEGIN
  IF NEW.is_exhausted = true AND (OLD.is_exhausted IS NULL OR OLD.is_exhausted = false) THEN
    SELECT * INTO _chip FROM chips WHERE id = NEW.chip_id;
    IF FOUND THEN
      SELECT * INTO _modem FROM modems WHERE id = _chip.modem_id;
      IF FOUND THEN
        SELECT * INTO _location FROM locations WHERE id = _modem.location_id;
        IF FOUND THEN
          -- Get collaborator email safely as text
          SELECT u.email
          INTO _collaborator_email
          FROM auth.users u
          WHERE u.id = _location.user_id
          LIMIT 1;

          PERFORM net.http_post(
            url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/send-notification-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
            ),
            body := jsonb_build_object(
              'type', 'chip_exhausted',
              'data', jsonb_build_object(
                'phone_number', _chip.phone_number,
                'service_type', NEW.service_type,
                'collaborator_email', COALESCE(_collaborator_email, '')
              )
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;