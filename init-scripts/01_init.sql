CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Таблица пользователей (замена auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблица профилей (связана с users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    apartment VARCHAR(50),
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Таблица новостей
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

-- 4. Лицевые счета (accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(255) NOT NULL,
    apartment VARCHAR(50),
    debt_amount DECIMAL(10, 2) DEFAULT 0.00,
    period VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Расчеты калькулятора (calculations)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ТЕСТОВЫЕ ДАННЫЕ
-- Добавляем администратора (пароль admin123 в открытом виде для теста, потом будем хешировать в бекенде)
INSERT INTO users (id, email, password_hash, role) 
VALUES ('11111111-1111-1111-1111-111111111111', 'admin@domofond.ru', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, full_name, phone)
VALUES ('11111111-1111-1111-1111-111111111111', 'Главный Администратор', '+79991234567')
ON CONFLICT (id) DO NOTHING;

-- Тестовая новость
INSERT INTO news (title, content, excerpt, is_published)
VALUES (
    'Запуск новой системы', 
    'Мы успешно мигрировали на локальный PostgreSQL. Теперь все данные хранятся локально.',
    'Успешная миграция базы данных',
    true
);
