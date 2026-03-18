CREATE POLICY "Managers can update profiles"
ON public.profiles
FOR UPDATE
USING (is_manager(auth.uid()))
WITH CHECK (is_manager(auth.uid()));