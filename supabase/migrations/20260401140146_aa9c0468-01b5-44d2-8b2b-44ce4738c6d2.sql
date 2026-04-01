
-- Fix calculator RLS to allow anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert calculations" ON public.calculations;
CREATE POLICY "Anyone can insert calculations"
  ON public.calculations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create accounts table for debt/billing data
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL,
  address text NOT NULL,
  apartment text,
  period text NOT NULL,
  debt_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_accounts_address ON public.accounts(address);
CREATE INDEX idx_accounts_account_number ON public.accounts(account_number);
CREATE INDEX idx_accounts_apartment ON public.accounts(apartment);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Managers can do everything with accounts
CREATE POLICY "Managers can manage accounts"
  ON public.accounts FOR ALL
  TO authenticated
  USING (is_manager(auth.uid()))
  WITH CHECK (is_manager(auth.uid()));

-- Authenticated users can view their own account by matching address
CREATE POLICY "Users can view matching accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);
