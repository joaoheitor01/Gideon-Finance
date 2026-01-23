-- Add account_type to profiles table
ALTER TABLE public.profiles
ADD COLUMN account_type TEXT CHECK (account_type IN ('Pessoal', 'Empresarial'));

-- Update function to handle new account_type field
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, account_type)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'account_type');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
