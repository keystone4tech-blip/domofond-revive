-- ============================================================================
-- ФИКС: права на таблицу crm_roles (ошибка "permission denied for table crm_roles")
-- Таблица уже создана, но роли authenticated не выданы права. Этот скрипт
-- безопасно (идемпотентно) до-выдаёт права и перезагружает схему PostgREST.
--
-- Запуск на сервере:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < fix_crm_roles_grants.sql
-- ============================================================================

-- На случай, если таблицы всё же нет — создаём (иначе строки ниже просто применятся к существующей)
CREATE TABLE IF NOT EXISTS crm_roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Базовые системные роли (если ещё не вставлены)
INSERT INTO crm_roles (id, name, description, permissions, is_system) VALUES
  ('director',   'Директор',   'Полный доступ ко всем разделам CRM',
     '["dashboard","tasks","requests","installer-sheet","products","addresses","accounts","logins","employees","clients","map","reports","verification"]'::jsonb, true),
  ('manager',    'Менеджер',   'Управление заявками, задачами, каталогом и клиентами',
     '["dashboard","tasks","requests","installer-sheet","products","addresses","accounts","logins","clients","verification"]'::jsonb, true),
  ('dispatcher', 'Диспетчер',  'Приём и распределение заявок, задачи, лицевые счета',
     '["dashboard","tasks","requests","installer-sheet","products","addresses","accounts","logins"]'::jsonb, true),
  ('master',     'Мастер',     'Выполнение задач и заявок на выезде',
     '["dashboard","tasks","requests","installer-sheet","products","addresses","logins"]'::jsonb, true),
  ('engineer',   'Инженер',    'Монтаж и настройка оборудования',
     '["dashboard","tasks","requests","installer-sheet","products","addresses","logins"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- ГЛАВНОЕ: выдаём права роли authenticated (под ней работает залогиненный админ в PostgREST)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_roles TO authenticated;
REVOKE ALL ON crm_roles FROM anon;   -- аноним не должен трогать роли

-- Триггер автообновления updated_at
CREATE OR REPLACE FUNCTION set_crm_roles_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_crm_roles_updated_at ON crm_roles;
CREATE TRIGGER trg_crm_roles_updated_at BEFORE UPDATE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION set_crm_roles_updated_at();

-- Перезагружаем схему PostgREST, чтобы он сразу увидел таблицу и права
NOTIFY pgrst, 'reload schema';

-- Проверка (должно показать 5 ролей)
SELECT id, name, is_system FROM crm_roles ORDER BY is_system DESC, name;
