-- ============================================================================
-- МИГРАЦИЯ Этап 4: типы устройств и категории (управляемые), привязка оборудования
--   к услугам, данные анкеты об установленном оборудовании.
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < migration_stage4.sql
--   docker restart domofondar_postgrest
-- ============================================================================

-- 1. УПРАВЛЯЕМЫЕ КАТЕГОРИИ товаров/услуг (раньше были жёстко зашиты: equipment/service/material).
CREATE TABLE IF NOT EXISTS product_categories (
  id         uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  is_service boolean DEFAULT false,   -- true = это услуга (а не товар/материал)
  sort_order int  DEFAULT 100,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO product_categories (name, slug, is_service, sort_order) VALUES
  ('Оборудование', 'equipment', false, 10),
  ('Услуга',       'service',   true,  20),
  ('Материал',     'material',  false, 30)
ON CONFLICT (slug) DO NOTHING;

-- 2. УПРАВЛЯЕМЫЕ ТИПЫ УСТРОЙСТВ (Трубка, Видеомонитор, и любые новые — заказчик добавляет сам).
CREATE TABLE IF NOT EXISTS device_types (
  id         uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  sort_order int  DEFAULT 100,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO device_types (name, slug, sort_order) VALUES
  ('Трубка (ТКП)',  'handset', 10),
  ('Видеомонитор',  'monitor', 20)
ON CONFLICT (slug) DO NOTHING;

-- 3. ПОЛЯ ТОВАРОВ/УСЛУГ:
--    device_type_id — к какому типу устройства относится товар (трубка/монитор) ИЛИ
--                     на какое устройство рассчитана услуга;
--    service_action — только для услуг: 'install' (установка) | 'replace' (замена).
ALTER TABLE products ADD COLUMN IF NOT EXISTS device_type_id uuid REFERENCES device_types(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS service_action text;   -- install | replace | NULL

-- 4. АНКЕТА: что установлено у жильца сейчас.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_intercom boolean;                 -- есть ли домофон/трубка
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_device_type_id uuid
  REFERENCES device_types(id) ON DELETE SET NULL;                                    -- что именно (трубка/монитор)

-- 5. Индексы под фильтрацию заказа по типу устройства.
CREATE INDEX IF NOT EXISTS idx_products_device_type ON products (device_type_id);

-- 6. Права + перечитывание схемы PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON product_categories TO authenticated;
GRANT SELECT ON product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON device_types TO authenticated;
GRANT SELECT ON device_types TO anon;
NOTIFY pgrst, 'reload schema';

SELECT 'Этап 4: миграция применена' AS status,
       (SELECT count(*) FROM product_categories) AS categories,
       (SELECT count(*) FROM device_types)       AS device_types;
