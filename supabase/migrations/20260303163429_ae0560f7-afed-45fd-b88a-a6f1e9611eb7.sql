
-- Create a function that calls the edge function to send email on new ticket
CREATE OR REPLACE FUNCTION public.send_ticket_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_role_key text;
BEGIN
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Use pg_net to call edge function asynchronously
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'type', 'new_ticket',
      'data', jsonb_build_object(
        'subject', NEW.subject,
        'message', NEW.message,
        'screenshot_url', NEW.screenshot_url
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create a function that calls the edge function when chip is exhausted
CREATE OR REPLACE FUNCTION public.send_chip_exhausted_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _chip RECORD;
  _modem RECORD;
  _location RECORD;
  _profile RECORD;
BEGIN
  IF NEW.is_exhausted = true AND (OLD.is_exhausted IS NULL OR OLD.is_exhausted = false) THEN
    SELECT * INTO _chip FROM chips WHERE id = NEW.chip_id;
    IF FOUND THEN
      SELECT * INTO _modem FROM modems WHERE id = _chip.modem_id;
      IF FOUND THEN
        SELECT * INTO _location FROM locations WHERE id = _modem.location_id;
        IF FOUND THEN
          -- Try to get collaborator email from auth.users
          SELECT raw_user_meta_data->>'email' INTO _profile FROM auth.users WHERE id = _location.user_id;
          
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
                'collaborator_email', COALESCE(_profile, '')
              )
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_send_ticket_email ON support_tickets;
CREATE TRIGGER trg_send_ticket_email
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION send_ticket_email();

DROP TRIGGER IF EXISTS trg_send_chip_exhausted_email ON chip_activations;
CREATE TRIGGER trg_send_chip_exhausted_email
  AFTER INSERT OR UPDATE ON chip_activations
  FOR EACH ROW
  EXECUTE FUNCTION send_chip_exhausted_email();
