-- Таблица сотрудников с расширенной информацией
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  current_location JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Таблица клиентов/объектов
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  contact_person TEXT,
  notes TEXT,
  location JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Таблица задач
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Таблица фотоотчетов
CREATE TABLE public.task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  location JSONB,
  caption TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Таблица чек-листов для задач
CREATE TABLE public.task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- История местоположений сотрудников
CREATE TABLE public.location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  location JSONB NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

-- Функция проверки FSM ролей
CREATE OR REPLACE FUNCTION public.has_fsm_role(_user_id uuid)
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
      AND role IN ('admin', 'director', 'dispatcher', 'master', 'engineer')
  )
$$;

-- Функция проверки управляющих ролей (директор, диспетчер, админ)
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
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
      AND role IN ('admin', 'director', 'dispatcher')
  )
$$;

-- RLS для employees
CREATE POLICY "Managers can view all employees"
ON public.employees FOR SELECT
USING (public.is_manager(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Managers can insert employees"
ON public.employees FOR INSERT
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can update employees"
ON public.employees FOR UPDATE
USING (public.is_manager(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Only admins can delete employees"
ON public.employees FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS для clients
CREATE POLICY "FSM users can view clients"
ON public.clients FOR SELECT
USING (public.has_fsm_role(auth.uid()));

CREATE POLICY "Managers can insert clients"
ON public.clients FOR INSERT
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can update clients"
ON public.clients FOR UPDATE
USING (public.is_manager(auth.uid()));

CREATE POLICY "Only admins can delete clients"
ON public.clients FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS для tasks
CREATE POLICY "FSM users can view relevant tasks"
ON public.tasks FOR SELECT
USING (
  public.is_manager(auth.uid()) OR 
  assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "Managers can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "FSM users can update tasks"
ON public.tasks FOR UPDATE
USING (
  public.is_manager(auth.uid()) OR 
  assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "Only managers can delete tasks"
ON public.tasks FOR DELETE
USING (public.is_manager(auth.uid()));

-- RLS для task_photos
CREATE POLICY "FSM users can view task photos"
ON public.task_photos FOR SELECT
USING (public.has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can insert photos"
ON public.task_photos FOR INSERT
WITH CHECK (public.has_fsm_role(auth.uid()));

CREATE POLICY "Users can delete own photos"
ON public.task_photos FOR DELETE
USING (uploaded_by = auth.uid() OR public.is_manager(auth.uid()));

-- RLS для task_checklists
CREATE POLICY "FSM users can view checklists"
ON public.task_checklists FOR SELECT
USING (public.has_fsm_role(auth.uid()));

CREATE POLICY "Managers can manage checklists"
ON public.task_checklists FOR INSERT
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete checklists"
ON public.task_checklists FOR DELETE
USING (public.is_manager(auth.uid()));

CREATE POLICY "FSM users can update checklists"
ON public.task_checklists FOR UPDATE
USING (public.has_fsm_role(auth.uid()));

-- RLS для location_history
CREATE POLICY "Managers can view all locations"
ON public.location_history FOR SELECT
USING (public.is_manager(auth.uid()));

CREATE POLICY "Employees can insert own location"
ON public.location_history FOR INSERT
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Триггеры для updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime для задач
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;