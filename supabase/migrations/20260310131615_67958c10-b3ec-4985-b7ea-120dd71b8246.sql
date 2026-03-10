
-- For duplicate chips (same phone_number), migrate references to the newest record and delete old ones
DO $$
DECLARE
  _phone text;
  _keep_id uuid;
  _old_ids uuid[];
BEGIN
  FOR _phone IN
    SELECT phone_number FROM chips GROUP BY phone_number HAVING COUNT(*) > 1
  LOOP
    -- Keep the newest chip (current port)
    SELECT id INTO _keep_id FROM chips WHERE phone_number = _phone ORDER BY created_at DESC LIMIT 1;
    
    -- Get old IDs
    SELECT array_agg(id) INTO _old_ids FROM chips WHERE phone_number = _phone AND id != _keep_id;
    
    -- Migrate chip_activations
    UPDATE chip_activations SET chip_id = _keep_id WHERE chip_id = ANY(_old_ids) 
      AND NOT EXISTS (SELECT 1 FROM chip_activations ca2 WHERE ca2.chip_id = _keep_id AND ca2.service_type = chip_activations.service_type);
    DELETE FROM chip_activations WHERE chip_id = ANY(_old_ids);
    
    -- Migrate sms_logs
    UPDATE sms_logs SET chip_id = _keep_id WHERE chip_id = ANY(_old_ids);
    
    -- Migrate orders
    UPDATE orders SET chip_id = _keep_id WHERE chip_id = ANY(_old_ids);
    
    -- Delete old chips
    DELETE FROM chips WHERE id = ANY(_old_ids);
  END LOOP;
END $$;

-- Delete orphan modems (no chips attached)
DELETE FROM modems WHERE id NOT IN (SELECT DISTINCT modem_id FROM chips);
