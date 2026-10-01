-- ============================================================================
-- МИГРАЦИЯ Этап 7: карточка сотрудника — кто назначил, когда, анкета сотрудника
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage7.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. МЕТА-ДАННЫЕ НАЗНАЧЕНИЯ: кто назначил сотрудника и когда.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_by       uuid;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_by_name  text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_at       timestamptz DEFAULT CURRENT_TIMESTAMP;

-- 2. АНКЕТА СОТРУДНИКА: заполняется самим сотрудником для активации.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth     date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS residence_address text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contact_phone     text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS activated_at      timestamptz;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees (user_id);

-- 3. Для уже существующих сотрудников: анкета считается не заполненной (false),
--    чтобы им показалось напоминание. assigned_at проставим из created_at,
--    если оно пустое (историческое назначение).
UPDATE employees SET assigned_at = created_at WHERE assigned_at IS NULL;

-- 4. Права + перечитывание схемы PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 7: миграция применена' AS status,
       (SELECT count(*) FROM employees) AS employees_rows,
       (SELECT count(*) FROM employees WHERE profile_completed) AS completed_rows;
