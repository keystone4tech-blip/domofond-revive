-- ============================================================================
-- МИГРАЦИЯ Этап 9: история статусов подъездов + раздел «Новые дома»
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage9.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. ЖУРНАЛ ПЕРЕХОДОВ СТАТУСА ПОДЪЕЗДА (история подъезда):
--    когда встал на монтаж, когда на ТО/аренду, кем изменено.
CREATE TABLE IF NOT EXISTS entrance_status_history (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  entrance_id     uuid,
  city            text,
  street          text,
  house           text,
  entrance        text,
  status          text NOT NULL,            -- installation | maintenance | rent | ...
  changed_at      timestamptz DEFAULT CURRENT_TIMESTAMP,
  changed_by      uuid,
  changed_by_name text
);
CREATE INDEX IF NOT EXISTS idx_entr_hist_entrance ON entrance_status_history (entrance_id);
CREATE INDEX IF NOT EXISTS idx_entr_hist_at ON entrance_status_history (changed_at DESC);

-- 2. СТАРТОВЫЕ ЗАПИСИ для подъездов, которые СЕЙЧАС на монтаже.
--    Берём дату создания подъезда как начало монтажа (новые адреса попадают
--    при загрузке абонентов). Только если истории ещё нет (идемпотентно).
INSERT INTO entrance_status_history (entrance_id, city, street, house, entrance, status, changed_at, changed_by_name)
SELECT e.id, e.city, e.street, e.house, e.entrance, 'installation', e.created_at, 'Система (загрузка)'
FROM entrances e
WHERE e.service_type = 'installation'
  AND NOT EXISTS (
    SELECT 1 FROM entrance_status_history h WHERE h.entrance_id = e.id
  );

-- 3. Доступ менеджера к разделу «Новые дома» (админ/директор видят всё автоматически).
UPDATE crm_roles
SET permissions = (permissions::jsonb || '["new-buildings"]'::jsonb)
WHERE id = 'manager'
  AND NOT (permissions::jsonb ? 'new-buildings');

-- Добавим и в роль admin (на случай, если список прав используется где-то напрямую)
UPDATE crm_roles
SET permissions = (permissions::jsonb || '["new-buildings"]'::jsonb)
WHERE id = 'admin'
  AND NOT (permissions::jsonb ? 'new-buildings');

-- 4. Права + перечитывание схемы PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON entrance_status_history TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 9: миграция применена' AS status,
       (SELECT count(*) FROM entrance_status_history) AS history_rows,
       (SELECT count(*) FROM entrances WHERE service_type = 'installation') AS montage_entrances;
