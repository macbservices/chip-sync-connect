
-- Drop triggers that use net.http_post
DROP TRIGGER IF EXISTS trg_send_ticket_email ON support_tickets;
DROP TRIGGER IF EXISTS trg_send_chip_exhausted_email ON chip_activations;

-- Drop the functions that depend on net schema
DROP FUNCTION IF EXISTS public.send_ticket_email();
DROP FUNCTION IF EXISTS public.send_chip_exhausted_email();
