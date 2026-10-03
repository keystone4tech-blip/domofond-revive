-- ============================================================================
-- МИГРАЦИЯ Этап 10: согласие на рекламную рассылку (акции, скидки, новинки)
-- ФЗ «О рекламе» ст. 18 — реклама по сетям электросвязи только при согласии.
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage10.sql
--   docker restart domofondar_postgrest
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

NOTIFY pgrst, 'reload schema';

SELECT 'Этап 10: миграция применена' AS status,
       (SELECT count(*) FROM profiles WHERE marketing_consent) AS subscribed_rows;
