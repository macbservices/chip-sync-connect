
-- Step 1: Create enum
CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator', 'customer');

-- Step 2: Create user_roles table FIRST
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create has_role security definer function (table already exists now)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Step 4: Create RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 5: Add balance_cents to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0;

-- Step 6: Create recharge_requests table
CREATE TABLE public.recharge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  pix_proof_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recharge requests"
ON public.recharge_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create recharge requests"
ON public.recharge_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all recharge requests"
ON public.recharge_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update recharge requests"
ON public.recharge_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Step 7: Trigger for updated_at
CREATE TRIGGER update_recharge_requests_updated_at
BEFORE UPDATE ON public.recharge_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 8: Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.recharge_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
