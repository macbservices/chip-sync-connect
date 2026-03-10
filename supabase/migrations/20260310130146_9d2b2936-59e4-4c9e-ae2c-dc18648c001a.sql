
-- Delete duplicate modems, keeping the oldest per (location_id, port_name)
DELETE FROM chips WHERE modem_id IN (
  SELECT id FROM modems WHERE id NOT IN (
    SELECT DISTINCT ON (location_id, port_name) id
    FROM modems
    ORDER BY location_id, port_name, created_at ASC
  )
);

DELETE FROM modems WHERE id NOT IN (
  SELECT DISTINCT ON (location_id, port_name) id
  FROM modems
  ORDER BY location_id, port_name, created_at ASC
);

-- Delete duplicate chips, keeping the oldest per (modem_id, phone_number)
DELETE FROM chips WHERE id NOT IN (
  SELECT DISTINCT ON (modem_id, phone_number) id
  FROM chips
  ORDER BY modem_id, phone_number, created_at ASC
);

-- Add unique constraints to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS modems_location_port_unique ON modems (location_id, port_name);
CREATE UNIQUE INDEX IF NOT EXISTS chips_modem_phone_unique ON chips (modem_id, phone_number);
