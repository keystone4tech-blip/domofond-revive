-- ============================================================================
-- МИГРАЦИЯ Этап 5: наглядный подбор оборудования (сценарии → услуги → оборудование)
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage5.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. Сценарий (по анкете жильца) → какие УСЛУГИ показывать.
--    scenario: 'none' (нет домофона) | 'handset' (трубка) | 'monitor' (видеомонитор)
CREATE TABLE IF NOT EXISTS scenario_services (
  id         uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  scenario   text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scenario, product_id)
);
CREATE INDEX IF NOT EXISTS idx_scenario_services_scenario ON scenario_services (scenario);

-- 2. Услуга → какое ОБОРУДОВАНИЕ (товары) к ней привязано.
CREATE TABLE IF NOT EXISTS service_products (
  id         uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (service_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_service_products_service ON service_products (service_id);

-- 3. Права + перечитывание схемы PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON scenario_services TO authenticated;
GRANT SELECT ON scenario_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_products TO authenticated;
GRANT SELECT ON service_products TO anon;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 5: миграция применена' AS status,
       (SELECT count(*) FROM scenario_services) AS scenario_links,
       (SELECT count(*) FROM service_products)  AS service_equipment_links;
