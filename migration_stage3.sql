-- ============================================================================
-- МИГРАЦИЯ Этап 3: полная информация об абоненте (тариф, умный дом, статус, трубка/ЛК)
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage3.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. Столбцы для полной карточки абонента из файла "Список всех абонентов".
--    IF NOT EXISTS — миграцию можно гонять повторно без ошибок.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS full_name        TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone            TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS has_handset      BOOLEAN DEFAULT FALSE;  -- есть трубка
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS has_lk           BOOLEAN DEFAULT FALSE;  -- есть личный кабинет умного домофона
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS street           TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS house             TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS housing          TEXT;  -- корпус
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS entrance         TEXT;  -- подъезд
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_type     TEXT;  -- строка тарифа как в файле

-- 2. Тариф (разобранный) и умный дом.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tariff_name      TEXT;    -- название тарифа
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tariff_price     NUMERIC(10,2); -- руб/мес
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_smart_home    BOOLEAN DEFAULT FALSE; -- УфаНет / умный домофон

-- 3. Статус лицевого счёта. Новые записи автоматически получают 'new' (DEFAULT),
--    существующие свой статус сохраняют (импорт не трогает этот столбец).
--    Значения: new | active | to (тех.обслуживание) | montazh | arenda | terminated
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'new';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS contract_terminated BOOLEAN DEFAULT FALSE; -- договор расторгнут (скрыть из кабинета)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_import_at   TIMESTAMPTZ;

-- Проставим осмысленный статус существующим строкам, где он пуст.
UPDATE accounts SET status = 'active' WHERE status IS NULL;

-- 4. Индексы под фильтрацию по статусу и по «умному дому».
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);

ANALYZE accounts;

-- 5. Права PostgREST + перечитывание схемы.
GRANT SELECT, INSERT, UPDATE ON accounts TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 3: миграция применена' AS status,
       count(*) FILTER (WHERE status = 'new')        AS new_cnt,
       count(*) FILTER (WHERE is_smart_home)         AS smart_cnt,
       count(*) FILTER (WHERE contract_terminated)   AS terminated_cnt
FROM accounts;
