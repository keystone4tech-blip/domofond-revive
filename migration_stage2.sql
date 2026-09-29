-- ============================================================================
-- МИГРАЦИЯ Этап 2: хранение лицевого счёта в профиле + индексы (снятие нагрузки на БД)
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage2.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. Храним привязанный лицевой счёт прямо в профиле — долг грузится по нему напрямую,
--    без перебора адресов (это и была причина падения БД).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_number TEXT;

-- 2. Триграммные индексы для быстрого поиска по адресу/улице (ILIKE '%...%' перестаёт
--    перебирать все 12 684 строки — главный источник нагрузки).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_accounts_address_trgm ON accounts USING gin (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_accounts_street_trgm  ON accounts USING gin (street  gin_trgm_ops);

-- 3. Индекс под каскад «улица → дом → подъезд → квартира».
CREATE INDEX IF NOT EXISTS idx_accounts_cascade ON accounts (street, house, entrance, apartment);

ANALYZE accounts;

-- 4. Права и перечитывание схемы PostgREST
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 2: миграция применена' AS status;

-- 5. Нормализованный телефон в профиле (для поиска по номеру в админке/CRM) — как в accounts.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_clean TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone,''),'[^0-9]','','g')) STORED;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_clean ON profiles(phone_clean);
NOTIFY pgrst, 'reload schema';
