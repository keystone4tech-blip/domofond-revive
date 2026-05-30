-- ============================================================
-- Скрипт выдачи привилегий для ролей anon и authenticated
-- на ВСЕ таблицы в схеме public.
-- Это необходимо для работы PostgREST, т.к. он подключается
-- под ролью anon (без JWT) или authenticated (с JWT).
-- ============================================================

-- 1. Привилегии для роли authenticated (авторизованные пользователи)
-- Полный доступ ко всем таблицам, последовательностям и функциям
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 2. Привилегии для роли anon (анонимные пользователи)
-- Чтение на все таблицы + INSERT на некоторые (requests, calculations, contacts, comments)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT INSERT ON requests TO anon;
GRANT INSERT ON calculations TO anon;
GRANT INSERT ON contacts TO anon;
GRANT INSERT ON comments TO anon;
GRANT INSERT ON likes TO anon;

-- 3. Автоматическое назначение привилегий для будущих таблиц
-- (чтобы при создании новых таблиц не нужно было вручную выдавать права)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;

-- 4. Информация о результате
DO $$
BEGIN
  RAISE NOTICE 'Привилегии успешно выданы для ролей anon и authenticated на все таблицы!';
END;
$$;
