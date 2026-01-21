ALTER TABLE public.profiles
ADD COLUMN failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN account_locked BOOLEAN DEFAULT false;
