-- ==============================================================================
-- СХЕМА И ПЕРВИЧНАЯ ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ «DOMOFONDAR» (ПРОДАКШН)
-- ==============================================================================
-- Выполняется автоматически при первом старте контейнера domofondar_postgres
-- База данных: domofondar
-- Пользователь: domofondar
-- ==============================================================================

-- 0. Расширения PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Создаем служебные роли для PostgREST
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
    RAISE NOTICE '[Init] Роль anon создана';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
    RAISE NOTICE '[Init] Роль authenticated создана';
  END IF;
END $$;

-- 2. Перечисление ролей пользователей
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM (
      'superadmin',   -- Главный разработчик с абсолютными правами
      'director',     -- Директор компании
      'admin',        -- Администратор
      'dispatcher',   -- Диспетчер
      'master',       -- Сервисный мастер
      'engineer',     -- Инженер
      'manager',      -- Менеджер
      'user'          -- Жилец / Абонент
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. ТАБЛИЦЫ ПОЛЬЗОВАТЕЛЕЙ И ПРОФИЛЕЙ
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    apartment VARCHAR(50),
    is_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(50) DEFAULT 'unverified',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

-- ------------------------------------------------------------------------------
-- 4. ТАБЛИЦЫ ЛИЦЕВЫХ СЧЕТОВ И БИЛЛИНГА (1С)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(255) NOT NULL,
    apartment VARCHAR(50),
    debt_amount DECIMAL(10, 2) DEFAULT 0.00,
    period VARCHAR(50) NOT NULL,
    phone TEXT DEFAULT NULL,
    full_name TEXT DEFAULT NULL,
    street TEXT DEFAULT NULL,
    house TEXT DEFAULT NULL,
    housing TEXT DEFAULT NULL,
    entrance TEXT DEFAULT NULL,
    has_handset BOOLEAN DEFAULT NULL,
    payment_type TEXT DEFAULT NULL,
    phone_clean TEXT GENERATED ALWAYS AS (REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone);
CREATE INDEX IF NOT EXISTS idx_accounts_phone_clean ON accounts(phone_clean);
CREATE INDEX IF NOT EXISTS idx_accounts_street_house ON accounts(street, house);

CREATE TABLE IF NOT EXISTS account_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    debt_amount DECIMAL(10, 2) NOT NULL,
    period VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_registry_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT NOT NULL,
    period TEXT NOT NULL,
    total_records INTEGER DEFAULT 0,
    total_debt DECIMAL(12, 2) DEFAULT 0.00,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entrances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    entrance_number TEXT NOT NULL,
    total_apartments INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intercom_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    entrance_number TEXT,
    device_model TEXT,
    ip_address TEXT,
    login TEXT,
    password_hash TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. ТАБЛИЦЫ СЕРВИСНОЙ СЛУЖБЫ (FSM), СОТРУДНИКОВ И ЗАЯВОК
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'master',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address VARCHAR(255),
    apartment VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    message TEXT,
    status VARCHAR(50) DEFAULT 'new',
    priority VARCHAR(50) DEFAULT 'medium',
    service_type VARCHAR(100),
    assigned_to UUID REFERENCES employees(id),
    accepted_by UUID REFERENCES employees(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    payment_status VARCHAR(50),
    payment_amount DECIMAL(10, 2),
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    product_id UUID,
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    title VARCHAR(255),
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    action VARCHAR(255),
    details TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES employees(id),
    assigned_by UUID REFERENCES employees(id),
    request_id UUID REFERENCES requests(id),
    scheduled_date TEXT,
    scheduled_time_start VARCHAR(10),
    scheduled_time_end VARCHAR(10),
    notes TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    photo_url VARCHAR(500),
    caption TEXT,
    location JSONB,
    uploaded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255),
    item_text TEXT,
    order_index INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    unit VARCHAR(50),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    total_apartments INTEGER NOT NULL DEFAULT 0,
    smart_intercoms INTEGER NOT NULL DEFAULT 0,
    entrances INTEGER NOT NULL DEFAULT 0,
    gates INTEGER NOT NULL DEFAULT 0,
    additional_cameras INTEGER NOT NULL DEFAULT 0,
    elevator_cameras INTEGER NOT NULL DEFAULT 0,
    is_individual BOOLEAN DEFAULT false,
    tariff_per_apt DECIMAL(10, 2),
    tariff_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. ТАБЛИЦЫ КОНТЕНТА, МАРКЕТИНГА И ОБРАТНОЙ СВЯЗИ
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_name VARCHAR(255),
    content TEXT,
    rating INTEGER,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type VARCHAR(50),
    target_id UUID,
    user_ip VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    image_url VARCHAR(500),
    video_url VARCHAR(500),
    is_published BOOLEAN DEFAULT false,
    is_auto_generated BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page TEXT,
    block_name TEXT,
    content JSONB,
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 7. ТАБЛИЦЫ ЧАТА, УВЕДОМЛЕНИЙ, ТЕЛЕГРАМА И ГОЛОСОВАНИЙ
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    messages_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(50),
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_widget_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_prompt TEXT,
    welcome_message TEXT,
    knowledge_base TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    p256dh TEXT,
    auth TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telegram_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telegram_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_user_id UUID REFERENCES telegram_users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS telegram_messages_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES telegram_conversations(id),
    direction VARCHAR(10),
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_page_meta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_path TEXT UNIQUE,
    title TEXT,
    description TEXT,
    keywords TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    canonical_url TEXT,
    json_ld JSONB,
    h1 TEXT,
    is_auto_managed BOOLEAN DEFAULT false,
    last_optimized_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name TEXT,
    default_title TEXT,
    default_description TEXT,
    google_analytics_id TEXT,
    yandex_metrika_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_path TEXT,
    action TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT,
    volume INTEGER,
    position INTEGER,
    page_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_path TEXT,
    suggestion TEXT,
    priority VARCHAR(50),
    is_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_automation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_active BOOLEAN DEFAULT false,
    schedule_cron TEXT,
    brand_pitch TEXT,
    topics TEXT,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    schedule_time TEXT,
    schedule_days TEXT,
    auto_publish_without_review BOOLEAN DEFAULT false,
    freshness_days INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE,
    title TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    content TEXT,
    source_urls TEXT[],
    seo_keywords TEXT[],
    segment_slug TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    requires_phone BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voting_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voting_id UUID REFERENCES votings(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'single',
    options JSONB,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voting_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES voting_questions(id) ON DELETE CASCADE,
    answer JSONB,
    voter_phone TEXT,
    voter_ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voting_ballots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voting_id UUID REFERENCES votings(id) ON DELETE CASCADE,
    voter_phone TEXT,
    voter_ip TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voting_phone_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voting_id UUID REFERENCES votings(id) ON DELETE CASCADE,
    phone TEXT,
    code TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 8. ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW unique_houses AS
SELECT DISTINCT split_part(address, ',', 1) || ',' || split_part(address, ',', 2) || ',' || split_part(address, ',', 3) AS house_address
FROM accounts;

-- ------------------------------------------------------------------------------
-- 9. ТРИГГЕРЫ
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, '') ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Вспомогательная функция извлечения ID текущего пользователя из JWT сессии
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- ------------------------------------------------------------------------------
-- 10. БЕЗОПАСНОСТЬ И ПРАВА ДОСТУПА (PERMISSIONS)
-- ------------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Права для авторизованных пользователей
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Публичные права (anon): чтение только общедоступных данных
GRANT SELECT ON news, promotions, products, comments, site_blocks, unique_houses, seo_page_meta, seo_settings TO anon;
GRANT INSERT ON requests, calculations, contacts, comments, likes TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Запрещаем анонимный доступ к персональным данным жильцов и лицевым счетам через PostgREST
REVOKE ALL ON accounts FROM anon;
REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON users FROM anon;
REVOKE ALL ON user_roles FROM anon;
REVOKE ALL ON employees FROM anon;
REVOKE ALL ON tasks FROM anon;
REVOKE ALL ON account_registry_uploads FROM anon;

-- ------------------------------------------------------------------------------
-- 11. НАЧАЛЬНЫЕ ПРОДАКШН-ПОЛЬЗОВАТЕЛИ (ЧИСТАЯ БАЗА ДАННЫХ)
-- ------------------------------------------------------------------------------

-- 1. Главный разработчик (Суперпользователь)
-- Email: viruscorp4@gmail.com, Пароль: SuperNatural24! (Bcrypt хэш)
INSERT INTO users (id, email, password_hash, role)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'viruscorp4@gmail.com',
    '$2b$10$SIKDfYXbnJ4nnLkY340tp.jEFP.HM6FE9530FzAwo.R..qGFUMdKe',
    'superadmin'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin';

INSERT INTO profiles (id, full_name, phone)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Главный Разработчик', '+79991234567')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO user_roles (user_id, role)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin')
ON CONFLICT DO NOTHING;

-- 2. Директор компании
-- Email: domofondar@mail.ru, Пароль: Domofondar2026! (Bcrypt хэш)
INSERT INTO users (id, email, password_hash, role)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'domofondar@mail.ru',
    '$2b$10$uY45GUInHs4/sZen4n2XiuC3gvO/zTQp/63ZPMw3ue0Bj6X6Kc3Hm',
    'director'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'director';

INSERT INTO profiles (id, full_name, phone)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Директор Домофондар', '+79034118393')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO user_roles (user_id, role)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'director')
ON CONFLICT DO NOTHING;

INSERT INTO employees (user_id, full_name, phone, role, is_active)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Директор Домофондар', '+79034118393', 'director', true)
ON CONFLICT DO NOTHING;

-- Приветственная новость об обновлении системы
INSERT INTO news (title, content, excerpt, is_published, published_at)
VALUES (
    'Запуск официального портала Домофондар',
    'Рады приветствовать вас на обновленном портале компании «Домофондар» (домофондар.рф). Здесь вы можете оплатить услуги домофонии, подать заявку на ремонт или установку оборудования, а также передать показания.',
    'Официальный запуск нового сервисного портала домофондар.рф',
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

RAISE NOTICE '=== База данных domofondar успешно инициализирована: созданы чистые таблицы, суперпользователь и директор ===';
