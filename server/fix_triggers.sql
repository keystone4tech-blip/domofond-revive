-- ============================================================
-- Исправление триггера handle_new_user() для локальной БД
-- (без зависимости от auth.users и raw_user_meta_data)
-- ============================================================

-- 1. Удаляем старый триггер
DROP TRIGGER IF EXISTS on_auth_user_created ON users;

-- 2. Пересоздаём функцию для локальной таблицы users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- При создании нового пользователя автоматически создаём ему профиль
  -- Используем email как начальное имя (будет обновлено позже пользователем)
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, '')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Создаём новый триггер привязанный к таблице users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Также исправляем функцию send_contact_notification (если она ссылается на Supabase)
-- Она может отсутствовать, поэтому обёрнуто в DO-блок
DO $$
BEGIN
  -- Удаляем триггер который вызывает несуществующий edge function
  DROP TRIGGER IF EXISTS on_contact_submitted ON contacts;
  RAISE NOTICE 'Триггер on_contact_submitted удалён (edge functions Supabase не доступны локально)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Триггер on_contact_submitted не найден, пропускаем';
END;
$$;
