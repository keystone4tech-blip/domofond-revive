-- Создаем таблицу для лайков
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
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
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
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
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.uid() IS NULL AND session_id IS NOT NULL)
);

-- Политики для likes: удалять можно только свои лайки
CREATE POLICY "Users can delete own likes"
ON public.likes
FOR DELETE
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.uid() IS NULL AND session_id IS NOT NULL)
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
WITH CHECK (auth.uid() = user_id);

-- Политики для comments: пользователи могут обновлять свои комментарии
CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Политики для comments: пользователи могут удалять свои комментарии
CREATE POLICY "Users can delete own comments"
ON public.comments
FOR DELETE
USING (auth.uid() = user_id);

-- Триггер для обновления updated_at в comments
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();