
-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  screenshot_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all tickets" ON public.support_tickets
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update tickets" ON public.support_tickets
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete tickets" ON public.support_tickets
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Create storage bucket for ticket screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-screenshots', 'ticket-screenshots', false);

CREATE POLICY "Users can upload own ticket screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ticket-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own ticket screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ticket-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin can view all ticket screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ticket-screenshots' AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
