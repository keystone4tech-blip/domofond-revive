CREATE OR REPLACE FUNCTION public.has_admin_console_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'director')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_role(_user_id uuid, _target_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin'::public.app_role) THEN true
    WHEN public.is_manager(_user_id) THEN _target_role <> 'admin'::public.app_role
    ELSE false
  END
$$;

DROP POLICY IF EXISTS "Managers can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can delete roles" ON public.user_roles;

CREATE POLICY "Managers can insert non-admin roles"
ON public.user_roles
FOR INSERT
TO public
WITH CHECK (public.can_manage_role(auth.uid(), role));

CREATE POLICY "Managers can update non-admin roles"
ON public.user_roles
FOR UPDATE
TO public
USING (public.can_manage_role(auth.uid(), role))
WITH CHECK (public.can_manage_role(auth.uid(), role));

CREATE POLICY "Managers can delete non-admin roles"
ON public.user_roles
FOR DELETE
TO public
USING (public.can_manage_role(auth.uid(), role));

DROP POLICY IF EXISTS "Admins can delete promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON public.promotions;

CREATE POLICY "Admin console can delete promotions"
ON public.promotions
FOR DELETE
TO public
USING (public.has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can insert promotions"
ON public.promotions
FOR INSERT
TO public
WITH CHECK (public.has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can update promotions"
ON public.promotions
FOR UPDATE
TO public
USING (public.has_admin_console_access(auth.uid()))
WITH CHECK (public.has_admin_console_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
DROP POLICY IF EXISTS "Admins can insert news" ON public.news;
DROP POLICY IF EXISTS "Admins can update news" ON public.news;

CREATE POLICY "Admin console can delete news"
ON public.news
FOR DELETE
TO public
USING (public.has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can insert news"
ON public.news
FOR INSERT
TO public
WITH CHECK (public.has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can update news"
ON public.news
FOR UPDATE
TO public
USING (public.has_admin_console_access(auth.uid()))
WITH CHECK (public.has_admin_console_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete chat settings" ON public.chat_widget_settings;
DROP POLICY IF EXISTS "Admins can insert chat settings" ON public.chat_widget_settings;
DROP POLICY IF EXISTS "Admins can update chat settings" ON public.chat_widget_settings;

CREATE POLICY "Admin console can delete chat settings"
ON public.chat_widget_settings
FOR DELETE
TO public
USING (public.has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can insert chat settings"
ON public.chat_widget_settings
FOR INSERT
TO public
WITH CHECK (public.has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can update chat settings"
ON public.chat_widget_settings
FOR UPDATE
TO public
USING (public.has_admin_console_access(auth.uid()))
WITH CHECK (public.has_admin_console_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can update comments" ON public.comments;
DROP POLICY IF EXISTS "Users can view approved comments" ON public.comments;

CREATE POLICY "Admin console can update comments"
ON public.comments
FOR UPDATE
TO public
USING (public.has_admin_console_access(auth.uid()) OR auth.uid() = user_id)
WITH CHECK (public.has_admin_console_access(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Users can view approved comments or admin console"
ON public.comments
FOR SELECT
TO public
USING ((is_approved = true) OR public.has_admin_console_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage blocks" ON public.site_blocks;

CREATE POLICY "Admin console can manage blocks"
ON public.site_blocks
FOR ALL
TO public
USING (public.has_admin_console_access(auth.uid()))
WITH CHECK (public.has_admin_console_access(auth.uid()));