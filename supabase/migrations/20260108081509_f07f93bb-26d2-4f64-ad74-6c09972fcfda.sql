-- Политика INSERT для user_roles (только админы и директора могут назначать роли)
CREATE POLICY "Managers can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.is_manager(auth.uid())
);

-- Политика UPDATE для user_roles
CREATE POLICY "Managers can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_manager(auth.uid()));

-- Политика DELETE для user_roles
CREATE POLICY "Managers can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (public.is_manager(auth.uid()));

-- Менеджеры могут видеть все роли
CREATE POLICY "Managers can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_manager(auth.uid()));