
-- Remove the overly permissive INSERT policy - SECURITY DEFINER triggers bypass RLS
DROP POLICY "Service can insert notifications" ON public.notifications;
