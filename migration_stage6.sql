-- ============================================================================
-- МИГРАЦИЯ Этап 6: журнал удалений (кто удалил) + мягкое удаление личных кабинетов
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage6.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. ЖУРНАЛ УДАЛЕНИЙ — единая история: что удалили, снимок, КТО удалил, когда.
CREATE TABLE IF NOT EXISTS deletion_log (
  id             uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  entity_type    text NOT NULL,          -- 'user' | 'role' | 'product' | 'address' | 'request' | ...
  entity_id      text,                   -- id удалённой записи (как строка)
  entity_label   text,                   -- человекочитаемая метка (ФИО, название и т.п.)
  snapshot       jsonb,                  -- снимок данных на момент удаления
  deleted_by     uuid,                   -- id сотрудника
  deleted_by_name text,                  -- имя сотрудника (для показа без join)
  deleted_at     timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deletion_log_type ON deletion_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_deletion_log_at   ON deletion_log (deleted_at DESC);

-- 2. МЯГКОЕ УДАЛЕНИЕ личных кабинетов (профилей) — данные сохраняются, можно восстановить.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles (deleted_at);

-- 3. Права + перечитывание схемы PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON deletion_log TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 6: миграция применена' AS status,
       (SELECT count(*) FROM deletion_log) AS log_rows;
