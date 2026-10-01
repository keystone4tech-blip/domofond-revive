-- ============================================================================
-- МИГРАЦИЯ Этап 8: фотография сотрудника в анкете (карточке)
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage8.sql
--   docker restart domofondar_postgrest
-- ============================================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url text;

NOTIFY pgrst, 'reload schema';

SELECT 'Этап 8: миграция применена' AS status,
       (SELECT count(*) FROM employees WHERE photo_url IS NOT NULL) AS with_photo;
