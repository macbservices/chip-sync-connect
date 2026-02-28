-- Add unique constraint for upsert on chip_activations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chip_activations_chip_id_service_type_key'
  ) THEN
    ALTER TABLE public.chip_activations 
      ADD CONSTRAINT chip_activations_chip_id_service_type_key 
      UNIQUE (chip_id, service_type);
  END IF;
END $$;