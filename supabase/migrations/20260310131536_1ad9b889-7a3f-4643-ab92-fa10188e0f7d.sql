
-- Delete duplicate chips keeping the oldest record
DELETE FROM chips
WHERE id NOT IN (
  SELECT DISTINCT ON (modem_id, phone_number) id
  FROM chips
  ORDER BY modem_id, phone_number, created_at ASC
);

-- Delete duplicate modems keeping the oldest record  
DELETE FROM modems
WHERE id NOT IN (
  SELECT DISTINCT ON (location_id, port_name) id
  FROM modems
  ORDER BY location_id, port_name, created_at ASC
);
