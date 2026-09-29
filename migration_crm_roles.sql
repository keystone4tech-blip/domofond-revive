-- ============================================================================
-- МИГРАЦИЯ: таблица crm_roles (конструктор ролей CRM)
-- Проект «Домофондар». Причина: после переезда с Supabase таблица не была создана,
-- из-за чего в CRM не работал раздел «Сотрудники и роли» и не грузились права
-- для сотрудников (кроме админа/директора).
--
-- Запуск на сервере:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_crm_roles.sql
--   docker restart domofondar_postgrest        # чтобы PostgREST перечитал схему
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_roles (
    id          TEXT PRIMARY KEY,                    -- строковый идентификатор роли (director, master, ...)
    name        TEXT NOT NULL,                       -- отображаемое название
    description TEXT,                                -- описание
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,  -- массив id вкладок FSM
    is_system   BOOLEAN NOT NULL DEFAULT false,      -- системную роль нельзя удалить
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Базовые системные роли с правами по умолчанию (id вкладок совпадают с FSM_TABS в src/types/crmRoles.ts)
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

-- Права доступа для PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_roles TO authenticated;
REVOKE ALL ON crm_roles FROM anon;   -- аноним не должен видеть/менять роли

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION set_crm_roles_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_crm_roles_updated_at ON crm_roles;
CREATE TRIGGER trg_crm_roles_updated_at BEFORE UPDATE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION set_crm_roles_updated_at();
