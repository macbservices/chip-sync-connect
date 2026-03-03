
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Admin can insert notifications for any user
CREATE POLICY "Admin can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- System/service role can insert (for triggers)
CREATE POLICY "Service can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify admin when a support ticket is created
CREATE OR REPLACE FUNCTION public.notify_admin_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _admin RECORD;
BEGIN
  FOR _admin IN SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (_admin.user_id, 'Novo ticket de suporte', 'Um cliente abriu um novo ticket: ' || NEW.subject, 'ticket', '/admin');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_support_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_ticket();

-- Trigger: notify collaborator when their chips are exhausted
CREATE OR REPLACE FUNCTION public.notify_chip_exhausted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _chip RECORD;
  _modem RECORD;
  _location RECORD;
BEGIN
  IF NEW.is_exhausted = true AND (OLD.is_exhausted IS NULL OR OLD.is_exhausted = false) THEN
    SELECT * INTO _chip FROM chips WHERE id = NEW.chip_id;
    IF FOUND THEN
      SELECT * INTO _modem FROM modems WHERE id = _chip.modem_id;
      IF FOUND THEN
        SELECT * INTO _location FROM locations WHERE id = _modem.location_id;
        IF FOUND THEN
          INSERT INTO notifications (user_id, title, message, type, link)
          VALUES (
            _location.user_id,
            'Chip esgotado',
            'O chip ' || _chip.phone_number || ' atingiu o limite de ativações para ' || NEW.service_type || '. Substitua-o na chipeira.',
            'chip_exhausted',
            '/dashboard'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_chip_exhausted
  AFTER INSERT OR UPDATE ON public.chip_activations
  FOR EACH ROW EXECUTE FUNCTION public.notify_chip_exhausted();

-- Trigger: notify customer when admin responds to their ticket
CREATE OR REPLACE FUNCTION public.notify_ticket_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes AND NEW.admin_notes IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (NEW.user_id, 'Resposta do suporte', 'Seu ticket "' || NEW.subject || '" recebeu uma resposta.', 'ticket_response', '/suporte');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_response
  AFTER UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_response();
