-- Скрипт миграции: Исправление RLS-политик для таблиц новостей, акций и контентных блоков.
-- Этот скрипт создает безопасную функцию извлечения UUID авторизованного пользователя
-- и обновляет политики RLS для promotions, news и site_blocks, предотвращая ошибки типов
-- при анонимных (гостевых) запросах.

-- 1. Создаем (или обновляем) функцию безопасного получения UUID текущего авторизованного пользователя
-- Функция извлекает параметр request.jwt.claim.sub (который устанавливается PostgREST/Supabase на основе JWT).
-- Если пользователь не авторизован, параметр будет пустой строкой '' или NULL.
-- NULLIF() преобразует пустую строку '' в NULL, что предотвращает ошибку приведения к uuid (::uuid).
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


-- ==========================================
-- 2. Обновление политик для таблицы promotions (Акции)
-- ==========================================

-- Удаляем старую SELECT политику и создаем безопасную версию
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Anyone can view active promotions"
  ON public.promotions
  FOR SELECT
  USING (
    is_active = true 
    OR public.has_role(public.get_current_user_id(), 'admin')
  );

-- Обновляем политики модификации данных для админов (предотвращаем падение RLS при попытках изменения неавторизованными лицами)
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


-- ==========================================
-- 3. Обновление политик для таблицы news (Новости)
-- ==========================================

-- Удаляем старую SELECT политику и создаем безопасную версию
DROP POLICY IF EXISTS "Anyone can view published news" ON public.news;
CREATE POLICY "Anyone can view published news"
  ON public.news
  FOR SELECT
  USING (
    is_published = true 
    OR public.has_role(public.get_current_user_id(), 'admin')
  );

-- Обновляем политики изменения новостей
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


-- ==========================================
-- 4. Обновление политик для таблицы site_blocks (Контентные блоки сайта)
-- ==========================================

-- Удаляем старую SELECT политику и создаем безопасную версию
DROP POLICY IF EXISTS "Anyone can view active blocks" ON public.site_blocks;
CREATE POLICY "Anyone can view active blocks"
  ON public.site_blocks
  FOR SELECT
  USING (
    is_active = true 
    OR public.has_role(public.get_current_user_id(), 'admin')
  );

-- Обновляем политику администрирования блоков
DROP POLICY IF EXISTS "Admins can manage blocks" ON public.site_blocks;
DROP POLICY IF EXISTS "Admin console can manage blocks" ON public.site_blocks;
CREATE POLICY "Admin console can manage blocks"
  ON public.site_blocks
  FOR ALL
  TO public
  USING (public.has_admin_console_access(public.get_current_user_id()))
  WITH CHECK (public.has_admin_console_access(public.get_current_user_id()));
