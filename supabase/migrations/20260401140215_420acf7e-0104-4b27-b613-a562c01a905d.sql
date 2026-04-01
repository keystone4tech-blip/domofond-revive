
DROP POLICY IF EXISTS "Anyone can insert calculations" ON public.calculations;

CREATE POLICY "Anon can insert calculations"
  ON public.calculations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Auth can insert calculations"
  ON public.calculations FOR INSERT
  TO authenticated
  WITH CHECK (true);
