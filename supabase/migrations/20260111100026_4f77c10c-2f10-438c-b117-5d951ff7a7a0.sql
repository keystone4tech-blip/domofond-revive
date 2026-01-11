-- Добавить политику для менеджеров чтобы они могли искать все профили
CREATE POLICY "Managers can view all profiles"
ON public.profiles
FOR SELECT
USING (is_manager(auth.uid()));