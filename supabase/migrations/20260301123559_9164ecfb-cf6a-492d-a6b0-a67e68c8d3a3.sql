
-- Add fraud_alert column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fraud_alert text DEFAULT NULL;

-- Create fraud detection function
CREATE OR REPLACE FUNCTION public.detect_sms_fraud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _service_type text;
  _sms_text text;
  _sender_text text;
  _detected_service text;
BEGIN
  -- Only check incoming SMS
  IF NEW.direction <> 'incoming' THEN
    RETURN NEW;
  END IF;

  -- Find active order for this chip
  SELECT o.id, o.service_id, o.customer_id, s.type AS service_type, s.name AS service_name
  INTO _order
  FROM orders o
  JOIN services s ON s.id = o.service_id
  WHERE o.chip_id = NEW.chip_id
    AND o.status IN ('active', 'paid')
    AND o.created_at <= NEW.received_at
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _sms_text := LOWER(COALESCE(NEW.message, ''));
  _sender_text := LOWER(COALESCE(NEW.sender, ''));

  -- Detect which service the SMS actually belongs to
  _detected_service := NULL;

  -- WhatsApp patterns
  IF _sms_text LIKE '%whatsapp%' OR _sender_text LIKE '%whatsapp%' THEN
    _detected_service := 'whatsapp';
  -- Telegram patterns
  ELSIF _sms_text LIKE '%telegram%' OR _sender_text LIKE '%telegram%' THEN
    _detected_service := 'telegram';
  -- Google/Gmail patterns
  ELSIF _sms_text LIKE '%google%' OR _sms_text LIKE '%gmail%' OR _sender_text LIKE '%google%' THEN
    _detected_service := 'gmail';
  -- Instagram patterns
  ELSIF _sms_text LIKE '%instagram%' OR _sender_text LIKE '%instagram%' THEN
    _detected_service := 'instagram';
  -- Facebook patterns
  ELSIF _sms_text LIKE '%facebook%' OR _sms_text LIKE '%fb %' OR _sender_text LIKE '%facebook%' THEN
    _detected_service := 'facebook';
  -- TikTok patterns
  ELSIF _sms_text LIKE '%tiktok%' OR _sender_text LIKE '%tiktok%' THEN
    _detected_service := 'tiktok';
  -- Twitter/X patterns
  ELSIF _sms_text LIKE '%twitter%' OR _sms_text LIKE '% x %' OR _sender_text LIKE '%twitter%' THEN
    _detected_service := 'twitter';
  END IF;

  -- If we detected a service and it doesn't match the purchased service type, flag fraud
  IF _detected_service IS NOT NULL AND _detected_service <> LOWER(_order.service_type) THEN
    UPDATE orders 
    SET fraud_alert = 'SMS de ' || UPPER(_detected_service) || ' detectado em pedido de ' || UPPER(_order.service_type),
        updated_at = now()
    WHERE id = _order.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on sms_logs
DROP TRIGGER IF EXISTS trg_detect_sms_fraud ON public.sms_logs;
CREATE TRIGGER trg_detect_sms_fraud
  AFTER INSERT ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_sms_fraud();
