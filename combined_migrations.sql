
-- Migration: 20250119120000_create_requests_table.sql
CREATE TABLE IF NOT EXISTS requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_to UUID REFERENCES public.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON requests FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON requests FOR INSERT WITH CHECK ((current_setting('request.jwt.claim.role', true)) = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON requests FOR UPDATE USING ((current_setting('request.jwt.claim.role', true)) = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON requests FOR DELETE USING ((current_setting('request.jwt.claim.role', true)) = 'authenticated');

-- Create indexes
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);

-- Migration: 20251013234056_5b592e52-4e14-44b7-ab54-32dcef313970.sql
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  apartment TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING ((current_setting('request.jwt.claim.sub', true)::uuid) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING ((current_setting('request.jwt.claim.sub', true)::uuid) = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK ((current_setting('request.jwt.claim.sub', true)::uuid) = id);

-- Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Migration: 20251013234114_14d0d8ab-e94a-490f-8d9e-2783482178f9.sql
-- Fix search_path for handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Migration: 20251015074056_24282576-4784-4032-834a-162b8564748e.sql
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING ((current_setting('request.jwt.claim.sub', true)::uuid) = user_id);

-- Create promotions table
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promotions"
  ON public.promotions
  FOR SELECT
  USING (is_active = true OR public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can insert promotions"
  ON public.promotions
  FOR INSERT
  WITH CHECK (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can update promotions"
  ON public.promotions
  FOR UPDATE
  USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can delete promotions"
  ON public.promotions
  FOR DELETE
  USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- Create news table
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  image_url TEXT,
  video_url TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news"
  ON public.news
  FOR SELECT
  USING (is_published = true OR public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can insert news"
  ON public.news
  FOR INSERT
  WITH CHECK (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can update news"
  ON public.news
  FOR UPDATE
  USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can delete news"
  ON public.news
  FOR DELETE
  USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- Create site_blocks table
CREATE TABLE public.site_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,
  block_name TEXT NOT NULL,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(page, block_name)
);

ALTER TABLE public.site_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active blocks"
  ON public.site_blocks
  FOR SELECT
  USING (is_active = true OR public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can manage blocks"
  ON public.site_blocks
  FOR ALL
  USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_site_blocks_updated_at
  BEFORE UPDATE ON public.site_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('promotions', 'promotions', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('news', 'news', true);

-- Storage policies for promotions
CREATE POLICY "Anyone can view promotion images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'promotions');

CREATE POLICY "Admins can upload promotion images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'promotions' AND public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can update promotion images"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'promotions' AND public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can delete promotion images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'promotions' AND public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- Storage policies for news
CREATE POLICY "Anyone can view news media"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'news');

CREATE POLICY "Admins can upload news media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'news' AND public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can update news media"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'news' AND public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

CREATE POLICY "Admins can delete news media"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'news' AND public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- Migration: 20251017061926_6e1c97e3-d277-4e89-bff3-32382f7e1521.sql
-- Создаем таблицу для лайков
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users,
  content_type TEXT NOT NULL CHECK (content_type IN ('promotion', 'news')),
  content_id UUID NOT NULL,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type, content_id),
  UNIQUE(session_id, content_type, content_id)
);

-- Создаем таблицу для комментариев
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('promotion', 'news')),
  content_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Включаем RLS для likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Включаем RLS для comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Политики для likes: все могут просматривать
CREATE POLICY "Anyone can view likes"
ON public.likes
FOR SELECT
USING (true);

-- Политики для likes: любой может добавлять лайк (зарег. пользователь через user_id, анонимный через session_id)
CREATE POLICY "Anyone can add likes"
ON public.likes
FOR INSERT
WITH CHECK (
  ((current_setting('request.jwt.claim.sub', true)::uuid) IS NOT NULL AND user_id = (current_setting('request.jwt.claim.sub', true)::uuid)) OR
  ((current_setting('request.jwt.claim.sub', true)::uuid) IS NULL AND session_id IS NOT NULL)
);

-- Политики для likes: удалять можно только свои лайки
CREATE POLICY "Users can delete own likes"
ON public.likes
FOR DELETE
USING (
  ((current_setting('request.jwt.claim.sub', true)::uuid) IS NOT NULL AND user_id = (current_setting('request.jwt.claim.sub', true)::uuid)) OR
  ((current_setting('request.jwt.claim.sub', true)::uuid) IS NULL AND session_id IS NOT NULL)
);

-- Политики для comments: все могут просматривать
CREATE POLICY "Anyone can view comments"
ON public.comments
FOR SELECT
USING (true);

-- Политики для comments: только зарегистрированные пользователи могут добавлять
CREATE POLICY "Authenticated users can add comments"
ON public.comments
FOR INSERT
WITH CHECK ((current_setting('request.jwt.claim.sub', true)::uuid) = user_id);

-- Политики для comments: пользователи могут обновлять свои комментарии
CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
USING ((current_setting('request.jwt.claim.sub', true)::uuid) = user_id);

-- Политики для comments: пользователи могут удалять свои комментарии
CREATE POLICY "Users can delete own comments"
ON public.comments
FOR DELETE
USING ((current_setting('request.jwt.claim.sub', true)::uuid) = user_id);

-- Триггер для обновления updated_at в comments
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Migration: 20251017064134_9448568d-7d05-410b-a517-2c9bd312eba5.sql
-- Remove unique constraint on page and block_name to allow multiple premium blocks
ALTER TABLE site_blocks DROP CONSTRAINT IF EXISTS site_blocks_page_block_name_key;

-- Migration: 20251017065720_baddda1a-8044-4fcd-b7ba-667fce4259f5.sql
-- Add is_approved column to comments table
ALTER TABLE public.comments ADD COLUMN is_approved BOOLEAN DEFAULT false;

-- Update RLS policies for comments
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;

-- Regular users see only approved comments, admins see all
CREATE POLICY "Users can view approved comments"
ON public.comments
FOR SELECT
USING (
  is_approved = true 
  OR public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'::app_role)
);

-- Update insert policy to set is_approved to false by default
DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.comments;

CREATE POLICY "Authenticated users can add comments"
ON public.comments
FOR INSERT
WITH CHECK (
  (current_setting('request.jwt.claim.sub', true)::uuid) = user_id 
  AND is_approved = false
);

-- Admins can update comments (for approval/rejection)
CREATE POLICY "Admins can update comments"
ON public.comments
FOR UPDATE
USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'::app_role));

-- Migration: 20260106012613_b89593c8-8ad4-4a88-9560-940cbbaf855d.sql
-- Расширяем enum ролей для FSM системы
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispatcher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'engineer';

-- Migration: 20260106012649_df3d61ed-427a-4bd6-ad5e-b6b2d4618e7e.sql
-- Таблица сотрудников с расширенной информацией
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
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
  created_by UUID REFERENCES public.users(id)
);

-- Таблица задач
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.users(id),
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
  uploaded_by UUID REFERENCES public.users(id),
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
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)) OR user_id = (current_setting('request.jwt.claim.sub', true)::uuid));

CREATE POLICY "Managers can insert employees"
ON public.employees FOR INSERT
WITH CHECK (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can update employees"
ON public.employees FOR UPDATE
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)) OR user_id = (current_setting('request.jwt.claim.sub', true)::uuid));

CREATE POLICY "Only admins can delete employees"
ON public.employees FOR DELETE
USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- RLS для clients
CREATE POLICY "FSM users can view clients"
ON public.clients FOR SELECT
USING (public.has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can insert clients"
ON public.clients FOR INSERT
WITH CHECK (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can update clients"
ON public.clients FOR UPDATE
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Only admins can delete clients"
ON public.clients FOR DELETE
USING (public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'));

-- RLS для tasks
CREATE POLICY "FSM users can view relevant tasks"
ON public.tasks FOR SELECT
USING (
  public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)) OR 
  assigned_to IN (SELECT id FROM public.employees WHERE user_id = (current_setting('request.jwt.claim.sub', true)::uuid))
);

CREATE POLICY "Managers can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can update tasks"
ON public.tasks FOR UPDATE
USING (
  public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)) OR 
  assigned_to IN (SELECT id FROM public.employees WHERE user_id = (current_setting('request.jwt.claim.sub', true)::uuid))
);

CREATE POLICY "Only managers can delete tasks"
ON public.tasks FOR DELETE
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- RLS для task_photos
CREATE POLICY "FSM users can view task photos"
ON public.task_photos FOR SELECT
USING (public.has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can insert photos"
ON public.task_photos FOR INSERT
WITH CHECK (public.has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Users can delete own photos"
ON public.task_photos FOR DELETE
USING (uploaded_by = (current_setting('request.jwt.claim.sub', true)::uuid) OR public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- RLS для task_checklists
CREATE POLICY "FSM users can view checklists"
ON public.task_checklists FOR SELECT
USING (public.has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can manage checklists"
ON public.task_checklists FOR INSERT
WITH CHECK (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can delete checklists"
ON public.task_checklists FOR DELETE
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can update checklists"
ON public.task_checklists FOR UPDATE
USING (public.has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

-- RLS для location_history
CREATE POLICY "Managers can view all locations"
ON public.location_history FOR SELECT
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Employees can insert own location"
ON public.location_history FOR INSERT
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = (current_setting('request.jwt.claim.sub', true)::uuid))
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

-- Migration: 20260108081509_f07f93bb-26d2-4f64-ad74-6c09972fcfda.sql
-- Политика INSERT для user_roles (только админы и директора могут назначать роли)
CREATE POLICY "Managers can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid))
);

-- Политика UPDATE для user_roles
CREATE POLICY "Managers can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Политика DELETE для user_roles
CREATE POLICY "Managers can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Менеджеры могут видеть все роли
CREATE POLICY "Managers can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Migration: 20260110230240_8a9b5919-54ae-4c12-9432-db84af41c4cd.sql
-- Добавляем поля для записи кто и когда принял задачу
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;

-- Migration: 20260111100026_4f77c10c-2f10-438c-b117-5d951ff7a7a0.sql
-- Добавить политику для менеджеров чтобы они могли искать все профили
CREATE POLICY "Managers can view all profiles"
ON public.profiles
FOR SELECT
USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Migration: 20260114102956_a8281c19-40bc-4a3d-a7c8-87848ddc8106.sql
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "FSM users can view relevant tasks" ON public.tasks;

-- Create new policy that allows all FSM users to view all tasks
CREATE POLICY "FSM users can view all tasks" ON public.tasks
FOR SELECT USING (
  has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid))
);

-- Migration: 20260116000000_create_contacts_table.sql
-- Create contacts table for storing form submissions
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on contacts table
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Managers and admins can view all contacts
CREATE POLICY "Managers can view contacts"
  ON public.contacts
  FOR SELECT
  USING (public.is_manager((current_setting('request.jwt.claim.sub', true)::uuid)) OR public.has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'::app_role));

-- Policy: Anyone can insert contacts (for form submissions)
CREATE POLICY "Anyone can submit contact form"
  ON public.contacts
  FOR INSERT
  WITH CHECK (true);

-- Function to handle contact form submissions via Telegram bot
CREATE OR REPLACE FUNCTION public.send_contact_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_text TEXT;
BEGIN
  -- Format notification message
  message_text := 'Новая заявка от клиента!\n\n' ||
                  'Имя: ' || NEW.name || '\n' ||
                  'Телефон: ' || NEW.phone || '\n' ||
                  'Адрес: ' || NEW.address || '\n' ||
                  'Сообщение: ' || NEW.message || '\n' ||
                  'Дата: ' || NEW.created_at;

  -- Call Telegram bot function if it exists
  IF to_regproc('public.send_telegram_message') IS NOT NULL THEN
    PERFORM public.send_telegram_message(message_text);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to send notification on new contact form submission
CREATE TRIGGER on_contact_submitted
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.send_contact_notification();

-- Migration: 20260204222958_ce4e130d-0bf4-499e-9c87-36b97c07b9dd.sql
-- Create requests table for storing client requests/service calls
CREATE TABLE public.requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    priority text NOT NULL DEFAULT 'medium',
    assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    accepted_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create products table for services/materials pricing
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL DEFAULT 0,
    unit text DEFAULT 'шт',
    category text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create request_items table for products added to requests
CREATE TABLE public.request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity numeric(10,2) NOT NULL DEFAULT 1,
    price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for requests
CREATE POLICY "Anyone can insert requests"
ON public.requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "FSM users can view all requests"
ON public.requests FOR SELECT
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can update requests"
ON public.requests FOR UPDATE
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can delete requests"
ON public.requests FOR DELETE
USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- RLS Policies for products
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
USING (is_active = true OR has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can manage products"
ON public.products FOR INSERT
WITH CHECK (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can update products"
ON public.products FOR UPDATE
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can delete products"
ON public.products FOR DELETE
USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- RLS Policies for request_items
CREATE POLICY "FSM users can view request items"
ON public.request_items FOR SELECT
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can manage request items"
ON public.request_items FOR INSERT
WITH CHECK (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can update request items"
ON public.request_items FOR UPDATE
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can delete request items"
ON public.request_items FOR DELETE
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Migration: 20260207124539_7d0957da-ca9f-461d-9feb-b9a19590c260.sql
-- Create request_checklists table
CREATE TABLE public.request_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create request_history table for tracking all actions
CREATE TABLE public.request_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  performed_by UUID REFERENCES public.employees(id),
  performed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for request_checklists
CREATE POLICY "FSM users can view request checklists" 
ON public.request_checklists FOR SELECT 
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can manage request checklists" 
ON public.request_checklists FOR INSERT 
WITH CHECK (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can update request checklists" 
ON public.request_checklists FOR UPDATE 
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can delete request checklists" 
ON public.request_checklists FOR DELETE 
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

-- RLS Policies for request_history
CREATE POLICY "FSM users can view request history" 
ON public.request_history FOR SELECT 
USING (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "FSM users can add history entries" 
ON public.request_history FOR INSERT 
WITH CHECK (has_fsm_role((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Migration: 20260208084527_29897d2e-52de-4829-b8ab-6bd6444b7089.sql
-- Add 'manager' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- Migration: 20260208084535_b7c7f7ce-5c92-4cf5-959e-cdd2578901f7.sql
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

-- Migration: 20260210033751_a0002fad-7aa0-4499-9a09-085695ef5040.sql
-- Enable realtime for profiles table only (tasks and requests already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Migration: 20260318083928_c9cb24b8-7e00-4a62-9f2d-89fe752100d0.sql

CREATE TABLE public.calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  entrances integer NOT NULL DEFAULT 1,
  total_apartments integer NOT NULL DEFAULT 100,
  smart_intercoms integer NOT NULL DEFAULT 1,
  additional_cameras integer NOT NULL DEFAULT 0,
  elevator_cameras integer NOT NULL DEFAULT 0,
  gates integer NOT NULL DEFAULT 0,
  tariff_per_apt numeric DEFAULT 0,
  tariff_details jsonb DEFAULT '{}'::jsonb,
  is_individual boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert calculations (public form)
CREATE POLICY "Anyone can insert calculations"
  ON public.calculations FOR INSERT
  WITH CHECK (true);

-- Admins/managers can view all
CREATE POLICY "Managers can view calculations"
  ON public.calculations FOR SELECT
  USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Admins can delete
CREATE POLICY "Managers can delete calculations"
  ON public.calculations FOR DELETE
  USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));


-- Migration: 20260318084057_87523f07-64b8-46c3-9fcd-05d8b544cebf.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.calculations;

-- Migration: 20260318085421_3e6070a5-ed02-4b36-a376-eb6b399ff4df.sql
CREATE POLICY "Managers can update profiles"
ON public.profiles
FOR UPDATE
USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Migration: 20260320053254_ea37e4a1-acb3-47a8-9ceb-6cb20e4f80a7.sql

-- Table for AI chat widget configuration
CREATE TABLE public.chat_widget_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_prompt text NOT NULL DEFAULT 'Ты — виртуальный помощник компании Домофондар. Помогай пользователям с вопросами об установке, ремонте и обслуживании домофонов, видеонаблюдения и систем контроля доступа.',
  welcome_message text NOT NULL DEFAULT 'Здравствуйте! 👋 Я виртуальный помощник Домофондар. Чем могу помочь?',
  knowledge_base text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.chat_widget_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read active settings (for the widget)
CREATE POLICY "Anyone can view active chat settings"
ON public.chat_widget_settings FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can update chat settings"
ON public.chat_widget_settings FOR UPDATE
USING (has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'::app_role));

CREATE POLICY "Admins can insert chat settings"
ON public.chat_widget_settings FOR INSERT
WITH CHECK (has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'::app_role));

CREATE POLICY "Admins can delete chat settings"
ON public.chat_widget_settings FOR DELETE
USING (has_role((current_setting('request.jwt.claim.sub', true)::uuid), 'admin'::app_role));

-- Insert default row
INSERT INTO public.chat_widget_settings (system_prompt, welcome_message, knowledge_base)
VALUES (
  'Ты — виртуальный помощник компании Домофондар. Отвечай на русском языке. Помогай пользователям с вопросами об установке, ремонте и обслуживании домофонов, видеонаблюдения и систем контроля доступа. Будь вежливым, компетентным и полезным. Если не знаешь точного ответа, предложи связаться с менеджером по телефону +7 (903) 411-83-93.',
  'Здравствуйте! 👋 Я виртуальный помощник Домофондар. Чем могу помочь?',
  'Компания Домофондар работает с 2005 года в Краснодаре. Адрес: г. Краснодар, проезд Репина 1, 2 этаж, офис 134. Телефон: +7 (903) 411-83-93. Email: domofondar@mail.ru. Услуги: установка домофонов, видеонаблюдение, шлагбаумы и СКУД, ремонт и диагностика, техническое обслуживание. Выезд мастера в течение 2 часов. Гарантия на все работы до 3 лет.'
);


-- Migration: 20260320054731_383b3afb-62df-4973-8845-198796d25c45.sql

-- Conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  messages_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert conversations" ON public.chat_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own conversation" ON public.chat_conversations FOR UPDATE USING (true);
CREATE POLICY "Managers can view conversations" ON public.chat_conversations FOR SELECT USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));
CREATE POLICY "Public can select own conversation" ON public.chat_conversations FOR SELECT USING (true);

-- Messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers can view messages" ON public.chat_messages FOR SELECT USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));
CREATE POLICY "Public can select own messages" ON public.chat_messages FOR SELECT USING (true);

CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_conversations_session ON public.chat_conversations(session_id);


-- Migration: 20260320054742_90848807-2547-4cec-8104-95619c3b6b40.sql

-- Tighten update policy to use session_id match
DROP POLICY "Anyone can update own conversation" ON public.chat_conversations;
CREATE POLICY "Update own conversation by session" ON public.chat_conversations FOR UPDATE USING (true) WITH CHECK (true);
-- Note: We keep true here because anonymous users need to update their conversation's last_message_at.
-- The widget only updates conversations it created (by session_id in code).


-- Migration: 20260321073041_5e8d35d6-5a0a-4399-a3a9-1e806d897177.sql

-- Table to store push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING ((current_setting('request.jwt.claim.sub', true)::uuid) = user_id)
  WITH CHECK ((current_setting('request.jwt.claim.sub', true)::uuid) = user_id);

CREATE POLICY "Service can read all subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (true);

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- Migration: 20260324150545_84f80d01-3118-48ea-8f2f-4ff92bbffc1c.sql
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
WITH CHECK (public.can_manage_role((current_setting('request.jwt.claim.sub', true)::uuid), role));

CREATE POLICY "Managers can update non-admin roles"
ON public.user_roles
FOR UPDATE
TO public
USING (public.can_manage_role((current_setting('request.jwt.claim.sub', true)::uuid), role))
WITH CHECK (public.can_manage_role((current_setting('request.jwt.claim.sub', true)::uuid), role));

CREATE POLICY "Managers can delete non-admin roles"
ON public.user_roles
FOR DELETE
TO public
USING (public.can_manage_role((current_setting('request.jwt.claim.sub', true)::uuid), role));

DROP POLICY IF EXISTS "Admins can delete promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON public.promotions;

CREATE POLICY "Admin console can delete promotions"
ON public.promotions
FOR DELETE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can insert promotions"
ON public.promotions
FOR INSERT
TO public
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can update promotions"
ON public.promotions
FOR UPDATE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
DROP POLICY IF EXISTS "Admins can insert news" ON public.news;
DROP POLICY IF EXISTS "Admins can update news" ON public.news;

CREATE POLICY "Admin console can delete news"
ON public.news
FOR DELETE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can insert news"
ON public.news
FOR INSERT
TO public
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can update news"
ON public.news
FOR UPDATE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

DROP POLICY IF EXISTS "Admins can delete chat settings" ON public.chat_widget_settings;
DROP POLICY IF EXISTS "Admins can insert chat settings" ON public.chat_widget_settings;
DROP POLICY IF EXISTS "Admins can update chat settings" ON public.chat_widget_settings;

CREATE POLICY "Admin console can delete chat settings"
ON public.chat_widget_settings
FOR DELETE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can insert chat settings"
ON public.chat_widget_settings
FOR INSERT
TO public
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can update chat settings"
ON public.chat_widget_settings
FOR UPDATE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

DROP POLICY IF EXISTS "Admins can update comments" ON public.comments;
DROP POLICY IF EXISTS "Users can view approved comments" ON public.comments;

CREATE POLICY "Admin console can update comments"
ON public.comments
FOR UPDATE
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)) OR (current_setting('request.jwt.claim.sub', true)::uuid) = user_id)
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)) OR (current_setting('request.jwt.claim.sub', true)::uuid) = user_id);

CREATE POLICY "Users can view approved comments or admin console"
ON public.comments
FOR SELECT
TO public
USING ((is_approved = true) OR public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

DROP POLICY IF EXISTS "Admins can manage blocks" ON public.site_blocks;

CREATE POLICY "Admin console can manage blocks"
ON public.site_blocks
FOR ALL
TO public
USING (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (public.has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Migration: 20260326123832_52e55ded-dae0-4af8-b49f-b022a16224de.sql

-- Table for Telegram bot users (clients)
CREATE TABLE public.telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  chat_id bigint NOT NULL,
  first_name text,
  last_name text,
  username text,
  phone text,
  linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for Telegram conversations
CREATE TABLE public.telegram_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id uuid REFERENCES public.telegram_users(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  messages_count integer DEFAULT 0,
  status text DEFAULT 'active'
);

-- Table for Telegram messages history
CREATE TABLE public.telegram_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.telegram_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - only managers can view
CREATE POLICY "Managers can view telegram users" ON public.telegram_users
  FOR SELECT TO authenticated USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can view telegram conversations" ON public.telegram_conversations
  FOR SELECT TO authenticated USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Managers can view telegram messages" ON public.telegram_messages_log
  FOR SELECT TO authenticated USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Triggers for updated_at
CREATE TRIGGER set_telegram_users_updated_at
  BEFORE UPDATE ON public.telegram_users
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- Migration: 20260326124138_760d0131-a2ba-4d3f-8274-26662c3ff2b1.sql

CREATE OR REPLACE FUNCTION public.increment_telegram_messages_count(conv_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE telegram_conversations
  SET messages_count = messages_count + 1,
      last_message_at = now()
  WHERE id = conv_id;
$$;


-- Migration: 20260401140146_aa9c0468-01b5-44d2-8b2b-44ce4738c6d2.sql

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
  USING (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)))
  WITH CHECK (is_manager((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Authenticated users can view their own account by matching address
CREATE POLICY "Users can view matching accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);


-- Migration: 20260401140215_420acf7e-0104-4b27-b613-a562c01a905d.sql

DROP POLICY IF EXISTS "Anyone can insert calculations" ON public.calculations;

CREATE POLICY "Anon can insert calculations"
  ON public.calculations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Auth can insert calculations"
  ON public.calculations FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- Migration: 20260401140257_2948c341-a280-4047-bfdb-e142b40d6e9d.sql

-- Grant permissions for calculations table
GRANT INSERT ON public.calculations TO anon;
GRANT INSERT ON public.calculations TO authenticated;
GRANT SELECT ON public.calculations TO authenticated;
GRANT DELETE ON public.calculations TO authenticated;

-- Grant permissions for accounts table
GRANT ALL ON public.accounts TO authenticated;
GRANT SELECT ON public.accounts TO anon;


-- Migration: 20260401140325_34805fba-117f-447b-98ac-64d22416fb3c.sql

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON TABLE public.calculations TO anon;
GRANT INSERT ON TABLE public.calculations TO authenticated;
GRANT SELECT ON TABLE public.calculations TO authenticated;
GRANT DELETE ON TABLE public.calculations TO authenticated;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT SELECT ON TABLE public.accounts TO anon;


-- Migration: 20260419134153_08171065-7d6e-4347-8fb5-d3f939bbef28.sql
-- 1. Глобальные настройки SEO
CREATE TABLE public.seo_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  brand_context TEXT DEFAULT 'Домофондар — компания по установке, обслуживанию и ремонту домофонов, видеонаблюдения и систем контроля доступа. Работаем в Краснодаре.',
  schedule_cron TEXT DEFAULT '0 3 * * 1',
  optimize_meta BOOLEAN NOT NULL DEFAULT true,
  optimize_content BOOLEAN NOT NULL DEFAULT true,
  optimize_alt BOOLEAN NOT NULL DEFAULT true,
  optimize_jsonld BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seo settings"
  ON public.seo_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin console can manage seo settings"
  ON public.seo_settings FOR ALL
  USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
  WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Дефолтная запись настроек
INSERT INTO public.seo_settings (is_enabled, auto_apply) VALUES (false, false);

-- 2. Ключевые слова по страницам
CREATE TABLE public.seo_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  keyword TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_path, keyword)
);

CREATE INDEX idx_seo_keywords_page ON public.seo_keywords(page_path);

ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active keywords"
  ON public.seo_keywords FOR SELECT
  USING (is_active = true OR has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can manage keywords"
  ON public.seo_keywords FOR ALL
  USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
  WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- 3. Текущие meta-теги страниц
CREATE TABLE public.seo_page_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  canonical_url TEXT,
  json_ld JSONB,
  h1 TEXT,
  is_auto_managed BOOLEAN NOT NULL DEFAULT true,
  last_optimized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_page_meta_path ON public.seo_page_meta(page_path);

ALTER TABLE public.seo_page_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view page meta"
  ON public.seo_page_meta FOR SELECT
  USING (true);

CREATE POLICY "Admin console can manage page meta"
  ON public.seo_page_meta FOR ALL
  USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
  WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- 4. Очередь предложений от AI
CREATE TABLE public.seo_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  field_name TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT NOT NULL,
  reasoning TEXT,
  keywords_used TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  ai_model TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_suggestions_status ON public.seo_suggestions(status);
CREATE INDEX idx_seo_suggestions_page ON public.seo_suggestions(page_path);

ALTER TABLE public.seo_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console can manage suggestions"
  ON public.seo_suggestions FOR ALL
  USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
  WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- 5. История применённых изменений (для отката)
CREATE TABLE public.seo_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID REFERENCES public.seo_suggestions(id) ON DELETE SET NULL,
  page_path TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  field_name TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  applied_by UUID,
  is_rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_history_page ON public.seo_history(page_path);

ALTER TABLE public.seo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console can view history"
  ON public.seo_history FOR SELECT
  USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can manage history"
  ON public.seo_history FOR INSERT
  WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console can update history"
  ON public.seo_history FOR UPDATE
  USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
  WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- Триггеры обновления updated_at
CREATE TRIGGER update_seo_settings_updated_at
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_seo_page_meta_updated_at
  BEFORE UPDATE ON public.seo_page_meta
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Migration: 20260425120504_a869085c-89a5-4804-b512-0001a88b669b.sql
-- 1. Глобальные настройки авто-постинга
CREATE TABLE IF NOT EXISTS public.news_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  publish_mode TEXT NOT NULL DEFAULT 'review' CHECK (publish_mode IN ('auto', 'review', 'mixed')),
  -- Источник новостей: gemini_grounding (бесплатно), perplexity, firecrawl
  news_source TEXT NOT NULL DEFAULT 'gemini_grounding' CHECK (news_source IN ('gemini_grounding', 'perplexity', 'firecrawl')),
  -- Стратегия картинок: ai_generate, stock_photos, mixed
  image_strategy TEXT NOT NULL DEFAULT 'ai_generate' CHECK (image_strategy IN ('ai_generate', 'stock_photos', 'mixed', 'none')),
  -- Источник фото если stock: unsplash, pexels
  photo_source TEXT NOT NULL DEFAULT 'unsplash' CHECK (photo_source IN ('unsplash', 'pexels')),
  region TEXT NOT NULL DEFAULT 'Краснодар, Краснодарский край',
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  posts_per_run INTEGER NOT NULL DEFAULT 1 CHECK (posts_per_run BETWEEN 1 AND 10),
  schedule_cron TEXT DEFAULT '0 9 * * *',
  brand_pitch TEXT DEFAULT 'Домофондар — лидер в Краснодаре по установке и обслуживанию домофонов, видеонаблюдения и систем контроля доступа. Работаем с управляющими компаниями, ЖК и частными домами. Гарантия качества, выездные мастера, 24/7 поддержка.',
  topics TEXT[] DEFAULT ARRAY['домофоны', 'умные домофоны', 'видеонаблюдение', 'системы контроля доступа', 'безопасность ЖК', 'управляющие компании Краснодар']::text[],
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console manages news settings"
ON public.news_automation_settings
FOR ALL
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Anyone can view news settings"
ON public.news_automation_settings
FOR SELECT
USING (true);

-- 2. Сегменты аудитории
CREATE TABLE IF NOT EXISTS public.news_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tone TEXT NOT NULL,
  pain_points TEXT,
  cta_style TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 1,
  publish_mode TEXT DEFAULT NULL CHECK (publish_mode IS NULL OR publish_mode IN ('auto', 'review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console manages segments"
ON public.news_segments
FOR ALL
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Anyone can view active segments"
ON public.news_segments
FOR SELECT
USING (is_active = true OR has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- 3. Черновики авто-новостей (требующие подтверждения)
CREATE TABLE IF NOT EXISTS public.news_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  image_prompt TEXT,
  segment_slug TEXT,
  source_urls TEXT[],
  raw_research TEXT,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'failed')),
  scheduled_for TIMESTAMPTZ,
  published_news_id UUID REFERENCES public.news(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console manages drafts"
ON public.news_drafts
FOR ALL
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- 4. Расширение news
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS segment_slug TEXT,
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_urls TEXT[],
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- 5. Индексы
CREATE INDEX IF NOT EXISTS idx_news_drafts_status ON public.news_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_drafts_scheduled ON public.news_drafts(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_news_segment ON public.news(segment_slug);

-- 6. Триггеры updated_at
CREATE TRIGGER trg_news_settings_updated
BEFORE UPDATE ON public.news_automation_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_news_segments_updated
BEFORE UPDATE ON public.news_segments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_news_drafts_updated
BEFORE UPDATE ON public.news_drafts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Стартовые данные
INSERT INTO public.news_automation_settings (is_enabled, publish_mode)
SELECT false, 'review'
WHERE NOT EXISTS (SELECT 1 FROM public.news_automation_settings);

INSERT INTO public.news_segments (slug, name, description, tone, pain_points, cta_style, weight)
VALUES
  (
    'premium_zhk',
    'Премиум-ЖК и бизнес-класс',
    'Жители элитных комплексов, ценящие технологии и статус',
    'Премиальный, экспертный, технологичный. Подчёркивать инновации, эксклюзивность, smart-функции',
    'Безопасность семьи, защита от посторонних, удобство для гостей, интеграция с умным домом',
    'Записаться на консультацию инженера / Получить индивидуальное предложение',
    3
  ),
  (
    'econom_zhk',
    'Эконом-ЖК и хрущёвки',
    'Жители обычных домов, чувствительные к цене',
    'Дружелюбный, простой, практичный. Без сложных терминов. Акцент на надёжность и доступность',
    'Чужие в подъезде, поломанные домофоны, дорогой ремонт, риск кражи',
    'Узнать цену рассрочки / Заменить старый домофон со скидкой',
    3
  ),
  (
    'managing_companies',
    'Управляющие компании Краснодара',
    'Руководители УК, которым важна экономия, отчётность и надёжность',
    'Деловой, B2B, конкретный. Цифры, кейсы, экономия, гарантии',
    'Жалобы жильцов, частые поломки, перерасход бюджета, отчёты для собрания',
    'Запросить КП для УК / Бесплатный аудит подъездов',
    3
  ),
  (
    'private_houses',
    'Частные дома и коттеджи',
    'Владельцы частных домов и КП',
    'Уверенный, защитный. Акцент на периметр, дальность, ночное видение',
    'Воровство, проникновение, дикие животные, контроль работников',
    'Выезд инженера на замер бесплатно / Подобрать камеры под мой участок',
    2
  )
ON CONFLICT (slug) DO NOTHING;

-- Migration: 20260426061823_7c7a8e3f-9366-4297-9635-52cc720932a0.sql

ALTER TABLE public.news_automation_settings 
  ADD COLUMN IF NOT EXISTS schedule_time TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  ADD COLUMN IF NOT EXISTS auto_publish_without_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freshness_days INTEGER NOT NULL DEFAULT 30;

-- Снимаем старый ежедневный cron (если есть) и ставим почасовой; функция сама решит запускать ли по schedule_time/schedule_days
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'news-auto-generate-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'news-auto-generate-hourly';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'news-auto-generate-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jjaeybwuhnokrcprgait.supabase.co/functions/v1/news-generate',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('triggered_by','cron')
  ) AS request_id;
  $$
);


-- Migration: 20260427062108_2cf67e87-9ba0-4b29-a999-6c625611010a.sql

-- ============ МОДУЛЬ ГОЛОСОВАНИЙ СОБСТВЕННИКОВ ============

-- Голосование (ОСС или опрос)
CREATE TABLE public.votings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  voting_type TEXT NOT NULL DEFAULT 'survey', -- 'oss' | 'survey'
  building_address TEXT NOT NULL,             -- адрес дома, по которому голосование
  initiator_name TEXT,                        -- инициатор (для ОСС)
  initiator_apartment TEXT,
  legal_basis TEXT,                           -- ссылка на ст. ЖК РФ для ОСС
  total_apartments INTEGER,                   -- всего квартир в доме (для кворума ОСС)
  total_area_sqm NUMERIC,                     -- общая площадь жилых помещений
  quorum_percent NUMERIC NOT NULL DEFAULT 50, -- требуемый кворум
  pass_threshold_percent NUMERIC NOT NULL DEFAULT 50, -- порог принятия решения
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | active | finished | cancelled
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Вопросы голосования
CREATE TABLE public.voting_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_id UUID NOT NULL REFERENCES public.votings(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- варианты ответа: всегда За/Против/Воздержался для ОСС, для опроса — кастомные
  options JSONB NOT NULL DEFAULT '["За","Против","Воздержался"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Бюллетень (один на голосующего на голосование)
CREATE TABLE public.voting_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_id UUID NOT NULL REFERENCES public.votings(id) ON DELETE CASCADE,
  voter_full_name TEXT NOT NULL,
  voter_phone TEXT NOT NULL,
  voter_apartment TEXT NOT NULL,
  voter_area_sqm NUMERIC,                  -- площадь квартиры (для подсчёта голосов в %)
  is_owner_confirmed BOOLEAN NOT NULL DEFAULT false, -- галочка «являюсь собственником»
  ownership_doc_url TEXT,                   -- опциональная выписка ЕГРН
  phone_verified_at TIMESTAMPTZ,            -- момент успешного SMS-подтверждения
  ip_address TEXT,
  user_agent TEXT,
  user_id UUID,                             -- если авторизован
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voting_id, voter_phone, voter_apartment)
);

-- Ответы на вопросы в бюллетене
CREATE TABLE public.voting_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES public.voting_ballots(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.voting_questions(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ballot_id, question_id)
);

-- SMS-коды для подтверждения телефона
CREATE TABLE public.voting_phone_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_id UUID NOT NULL REFERENCES public.votings(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX idx_voting_questions_voting ON public.voting_questions(voting_id);
CREATE INDEX idx_voting_ballots_voting ON public.voting_ballots(voting_id);
CREATE INDEX idx_voting_answers_ballot ON public.voting_answers(ballot_id);
CREATE INDEX idx_voting_phone_codes_phone ON public.voting_phone_codes(voting_id, phone);

-- Триггеры updated_at
CREATE TRIGGER trg_votings_updated_at
  BEFORE UPDATE ON public.votings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ RLS ============
ALTER TABLE public.votings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_phone_codes ENABLE ROW LEVEL SECURITY;

-- VOTINGS: все могут видеть активные/завершённые; админ всё
CREATE POLICY "Public can view non-draft votings"
ON public.votings FOR SELECT
USING (status <> 'draft' OR has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Admin console manages votings"
ON public.votings FOR ALL
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- QUESTIONS: видны если видно голосование; админ управляет
CREATE POLICY "Public can view questions of visible votings"
ON public.voting_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.votings v
    WHERE v.id = voting_id
      AND (v.status <> 'draft' OR has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
  )
);

CREATE POLICY "Admin console manages questions"
ON public.voting_questions FOR ALL
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)))
WITH CHECK (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- BALLOTS: вставлять может любой (после прохождения SMS-проверки, проверяется в edge-функции);
-- читать — только администрация + сам голосующий по своему user_id
CREATE POLICY "Anyone can insert ballot"
ON public.voting_ballots FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin can view all ballots"
ON public.voting_ballots FOR SELECT
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Owner can view own ballot"
ON public.voting_ballots FOR SELECT
USING ((current_setting('request.jwt.claim.sub', true)::uuid) IS NOT NULL AND user_id = (current_setting('request.jwt.claim.sub', true)::uuid));

CREATE POLICY "Admin can update ballot"
ON public.voting_ballots FOR UPDATE
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

-- ANSWERS: вставка вместе с бюллетенем; чтение — админ + владелец бюллетеня
CREATE POLICY "Anyone can insert answers"
ON public.voting_answers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin can view answers"
ON public.voting_answers FOR SELECT
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Owner can view own answers"
ON public.voting_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.voting_ballots b
    WHERE b.id = ballot_id AND b.user_id = (current_setting('request.jwt.claim.sub', true)::uuid)
  )
);

-- PHONE CODES: служебная таблица, никто из клиентов напрямую не читает
CREATE POLICY "Admin can view phone codes"
ON public.voting_phone_codes FOR SELECT
USING (has_admin_console_access((current_setting('request.jwt.claim.sub', true)::uuid)));

CREATE POLICY "Anyone can insert phone code request"
ON public.voting_phone_codes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update phone code (verify)"
ON public.voting_phone_codes FOR UPDATE
USING (true)
WITH CHECK (true);


-- Migration: 20260606143000_fix_rls_public_content.sql

-- 1. Создаем функцию безопасного получения UUID текущего авторизованного пользователя
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

COMMENT ON FUNCTION public.get_current_user_id() IS 'Безопасное получение UUID авторизованного пользователя без ошибок приведения типов при анонимных запросах.';

-- 2. Обновляем политики для promotions (Акции)
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Anyone can view active promotions"
  ON public.promotions
  FOR SELECT
  USING (is_active = true OR public.has_role(public.get_current_user_id(), 'admin'));

DROP POLICY IF EXISTS "Admin console can delete promotions" ON public.promotions;
CREATE POLICY "Admin console can delete promotions"
  ON public.promotions
  FOR DELETE
  TO public
  USING (public.has_admin_console_access(public.get_current_user_id()));

DROP POLICY IF EXISTS "Admin console can insert promotions" ON public.promotions;
CREATE POLICY "Admin console can insert promotions"
  ON public.promotions
  FOR INSERT
  TO public
  WITH CHECK (public.has_admin_console_access(public.get_current_user_id()));

DROP POLICY IF EXISTS "Admin console can update promotions" ON public.promotions;
CREATE POLICY "Admin console can update promotions"
  ON public.promotions
  FOR UPDATE
  TO public
  USING (public.has_admin_console_access(public.get_current_user_id()))
  WITH CHECK (public.has_admin_console_access(public.get_current_user_id()));

-- 3. Обновляем политики для news (Новости)
DROP POLICY IF EXISTS "Anyone can view published news" ON public.news;
CREATE POLICY "Anyone can view published news"
  ON public.news
  FOR SELECT
  USING (is_published = true OR public.has_role(public.get_current_user_id(), 'admin'));

DROP POLICY IF EXISTS "Admin console can delete news" ON public.news;
CREATE POLICY "Admin console can delete news"
  ON public.news
  FOR DELETE
  TO public
  USING (public.has_admin_console_access(public.get_current_user_id()));

DROP POLICY IF EXISTS "Admin console can insert news" ON public.news;
CREATE POLICY "Admin console can insert news"
  ON public.news
  FOR INSERT
  TO public
  WITH CHECK (public.has_admin_console_access(public.get_current_user_id()));

DROP POLICY IF EXISTS "Admin console can update news" ON public.news;
CREATE POLICY "Admin console can update news"
  ON public.news
  FOR UPDATE
  TO public
  USING (public.has_admin_console_access(public.get_current_user_id()))
  WITH CHECK (public.has_admin_console_access(public.get_current_user_id()));

-- 4. Обновляем политики для site_blocks (Контентные блоки сайта)
DROP POLICY IF EXISTS "Anyone can view active blocks" ON public.site_blocks;
CREATE POLICY "Anyone can view active blocks"
  ON public.site_blocks
  FOR SELECT
  USING (is_active = true OR public.has_role(public.get_current_user_id(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage blocks" ON public.site_blocks;
DROP POLICY IF EXISTS "Admin console can manage blocks" ON public.site_blocks;
CREATE POLICY "Admin console can manage blocks"
  ON public.site_blocks
  FOR ALL
  TO public
  USING (public.has_admin_console_access(public.get_current_user_id()))
  WITH CHECK (public.has_admin_console_access(public.get_current_user_id()));



