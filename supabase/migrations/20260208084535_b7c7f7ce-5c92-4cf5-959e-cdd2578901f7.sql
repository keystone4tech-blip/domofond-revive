-- Update has_fsm_role function to include manager role
CREATE OR REPLACE FUNCTION public.has_fsm_role(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'director', 'dispatcher', 'master', 'engineer', 'manager')
  )
$function$;

-- Update is_manager function to include manager role
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'director', 'dispatcher', 'manager')
  )
$function$;