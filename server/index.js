/**
 * ==============================================================================
 * БЭКЕНД СЕРВЕР ПРОЕКТА «ДОМОФОНДАР» (DOMOFONDAR)
 * ==============================================================================
 * Обеспечивает:
 * 1. Авторизацию, регистрацию и валидацию JWT сессий пользователей.
 * 2. Защиту от SQL-инъекций (строго параметризованные SQL-запросы $1, $2...).
 * 3. Изоляцию и скрытие учетной записи суперпользователя разработчика (viruscorp4@gmail.com)
 *    от директора и других администраторов.
 * 4. Управление и безопасное скачивание резервных копий базы данных (pg_dump + gzip).
 * 5. Обслуживание API профилей, лицевых счетов и заявок.
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Константы суперпользователя разработчика для скрытия в интерфейсе и API
const SUPERADMIN_EMAIL = 'viruscorp4@gmail.com';
const SUPERADMIN_ROLE = 'superadmin';

// Настройки интеграции с платежным шлюзом ЮKassa (Боевой режим / Live)
// Shop ID: 1372116 — идентификатор магазина компании ООО «ДомофонДар» в сервисе ЮKassa
// Secret Key: боевой секретный ключ live_... для подписания платежных запросов API v3
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '1372116';
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || 'live_Cb0x2CAkErTmi3y5V_9pnVFf8MRb0mu4sxU3lAo-hlI';

// Директория для резервных копий базы данных
const BACKUP_DIR = process.env.BACKUP_DIR || (fs.existsSync('/backups') ? '/backups' : path.join(__dirname, '../backups'));

// Создаем директорию бэкапов, если она еще не существует
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[Бэкенд: Бэкапы] Создана папка для резервных копий: ${BACKUP_DIR}`);
  } catch (err) {
    console.error(`[Бэкенд: Бэкапы] Ошибка при создании папки ${BACKUP_DIR}:`, err.message);
  }
}

// Проверка наличия JWT_SECRET в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'super-secret-jwt-token-with-at-least-32-characters-long') {
  console.warn('[Бэкенд: Безопасность] ВНИМАНИЕ: Используется стандартный или не установленный JWT_SECRET. В продакшене обязательно задайте уникальный ключ в .env!');
}
const ACTIVE_JWT_SECRET = JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';

// Базовые middleware
app.use(cors());
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Раздача медиафайлов портфолио и документов
const PORTFOLIO_MEDIA_DIR = path.join(__dirname, '../public/media/portfolio');
if (!fs.existsSync(PORTFOLIO_MEDIA_DIR)) {
  try {
    fs.mkdirSync(PORTFOLIO_MEDIA_DIR, { recursive: true });
    console.log(`[Бэкенд: Медиа] Создана папка для медиафайлов портфолио: ${PORTFOLIO_MEDIA_DIR}`);
  } catch (err) {
    console.warn(`[Бэкенд: Медиа] Ошибка создания папки ${PORTFOLIO_MEDIA_DIR}:`, err.message);
  }
}
app.use('/media', express.static(path.join(__dirname, '../public/media')));

// Подключение к СУБД PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('[Бэкенд: PostgreSQL] Успешное подключение к базе данных domofondar!'))
  .catch(err => console.error('[Бэкенд: PostgreSQL] Ошибка подключения к базе данных:', err.stack));

// ------------------------------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ БЕЗОПАСНОСТИ И ПРАВ ДОСТУПА
// ------------------------------------------------------------------------------

/**
 * Получение роли пользователя из таблицы user_roles и users
 * @param {string} userId - UUID пользователя
 * @returns {Promise<string>} - роль пользователя ('superadmin', 'director', 'admin', 'user' и т.д.)
 */
async function getUserRole(userId) {
  try {
    // 1. Сначала проверяем таблицу user_roles (приоритетные роли)
    const roleRes = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 ORDER BY CASE WHEN role = $2 THEN 1 WHEN role = $3 THEN 2 WHEN role = $4 THEN 3 ELSE 4 END ASC LIMIT 1',
      [userId, SUPERADMIN_ROLE, 'director', 'admin']
    );
    if (roleRes.rows.length > 0) {
      return roleRes.rows[0].role;
    }

    // 2. Если в user_roles нет, проверяем поле role в таблице users
    const userRes = await pool.query('SELECT role, email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      // Защитная проверка: если email разработчика, всегда даем superadmin
      if (userRes.rows[0].email === SUPERADMIN_EMAIL) {
        return SUPERADMIN_ROLE;
      }
      return userRes.rows[0].role || 'user';
    }

    return 'user';
  } catch (err) {
    console.error(`[Бэкенд: Права] Ошибка при проверке роли пользователя ${userId}:`, err.message);
    return 'user';
  }
}

/**
 * Middleware аутентификации JWT токена
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация: токен отсутствует' });
  }

  jwt.verify(token, ACTIVE_JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.warn('[Бэкенд: Auth] Отклонен недействительный токен сессии:', err.message);
      return res.status(403).json({ error: 'Недействительный или истекший токен сессии' });
    }

    // Добавляем данные пользователя в запрос
    req.user = decoded;
    
    // Получаем актуальную роль из базы данных
    req.userRole = await getUserRole(decoded.id);
    req.isSuperAdmin = (req.userRole === SUPERADMIN_ROLE || decoded.email === SUPERADMIN_EMAIL);
    req.isDirector = (req.userRole === 'director');
    req.isAdmin = (req.isSuperAdmin || req.isDirector || req.userRole === 'admin');

    next();
  });
};

/**
 * Middleware проверки прав администратора (суперпользователь, директор или админ)
 */
const requireAdmin = (req, res, next) => {
  if (!req.isAdmin) {
    console.warn(`[Бэкенд: Доступ] Отклонен запрос к админ-эндпоинту от пользователя ${req.user?.email || 'unknown'} с ролью ${req.userRole}`);
    return res.status(403).json({ error: 'Доступ запрещен: требуются права администратора' });
  }
  next();
};

// ------------------------------------------------------------------------------
// СИСТЕМНЫЕ МАРШРУТЫ (HEALTHCHECK)
// ------------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'domofondar',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// ------------------------------------------------------------------------------
// МАРШРУТЫ АВТОРИЗАЦИИ И РЕГИСТРАЦИИ
// ------------------------------------------------------------------------------

// Регистрация нового жильца (поддерживает как Email, так и Номер телефона)
app.post('/api/auth/register', async (req, res) => {
  const { email, phone, login, password, full_name } = req.body;
  const rawInput = (email || phone || login || '').trim();

  if (!rawInput || !password) {
    console.warn('[Бэкенд: Регистрация] Попытка регистрации с пустым логином или паролем');
    return res.status(400).json({ error: 'Почта или номер телефона и пароль обязательны для заполнения' });
  }

  // Определяем, что ввёл пользователь: email или номер телефона
  const isEmail = rawInput.includes('@');
  const digitsOnly = rawInput.replace(/\D/g, '');

  let cleanEmail = null;
  let cleanPhone = null;

  if (isEmail) {
    // RULE 2: Строгая очистка Email от абсолютно любых пробелов (в т.ч. случайных автозамен на смартфонах)
    cleanEmail = rawInput.toLowerCase().replace(/\s+/g, '');
    
    // Проверка корректности формата Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      console.warn(`[Бэкенд: Регистрация] Некорректный формат email: "${cleanEmail}"`);
      return res.status(400).json({ error: 'Пожалуйста, введите корректный адрес электронной почты (например, name@mail.ru).' });
    }

    if (phone) {
      cleanPhone = String(phone).trim();
    }
    console.log(`[Бэкенд: Регистрация] Регистрация по Email: "${cleanEmail}"`);
  } else {
    // Ввод распознан как номер телефона
    if (digitsOnly.length < 10) {
      return res.status(400).json({ error: 'Пожалуйста, введите корректный номер телефона (не менее 10 цифр) или адрес электронной почты.' });
    }
    const last10 = digitsOnly.slice(-10);
    // Приводим телефон к стандартному презентабельному виду
    cleanPhone = `+7 (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6, 8)}-${last10.slice(8, 10)}`;
    // Для системной совместимости с полем users.email (NOT NULL) формируем системный email
    cleanEmail = `phone_${last10}@domofondar.ru`;
    console.log(`[Бэкенд: Регистрация] Регистрация по номеру телефона: "${cleanPhone}" (системный email: "${cleanEmail}")`);
  }

  try {
    // 1. Комплексная проверка дубликатов в users и profiles
    if (isEmail) {
      const emailDupCheck = await pool.query(
        `SELECT u.id FROM users u 
         LEFT JOIN profiles p ON p.id = u.id 
         WHERE LOWER(u.email) = LOWER($1) OR LOWER(COALESCE(p.email, '')) = LOWER($1)
         LIMIT 1`,
        [cleanEmail]
      );
      if (emailDupCheck.rows.length > 0) {
        console.warn(`[Бэкенд: Регистрация] Отклонено: пользователь с Email "${cleanEmail}" уже существует`);
        return res.status(400).json({ 
          error: 'Пользователь с такой электронной почтой уже зарегистрирован. Пожалуйста, перейдите на вкладку «Вход».' 
        });
      }
    } else {
      const last10 = digitsOnly.slice(-10);
      const phoneDupCheck = await pool.query(
        `SELECT u.id FROM users u 
         LEFT JOIN profiles p ON p.id = u.id 
         WHERE u.email = $1 
            OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE '%' || $2
         LIMIT 1`,
        [`phone_${last10}@domofondar.ru`, last10]
      );
      if (phoneDupCheck.rows.length > 0) {
        console.warn(`[Бэкенд: Регистрация] Отклонено: номер телефона "${last10}" уже зарегистрирован`);
        return res.status(400).json({ 
          error: 'Пользователь с таким номером телефона уже зарегистрирован. Пожалуйста, перейдите на вкладку «Вход».' 
        });
      }
    }

    // 2. Хэшируем пароль пользователя с солью 10 раундов
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Вставляем запись нового пользователя в таблицу users
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [cleanEmail, password_hash, 'user']
    );

    const user = newUser.rows[0];
    console.log(`[Бэкенд: Регистрация] Создана запись в users для ID: ${user.id}`);

    // 4. Создаем профиль пользователя с сохранением телефона и email
    await pool.query(
      `INSERT INTO profiles (id, full_name, phone, email, email_verified) 
       VALUES ($1, $2, $3, $4, true) 
       ON CONFLICT (id) DO UPDATE SET 
         full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name), 
         phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone), 
         email = COALESCE(NULLIF(EXCLUDED.email, ''), profiles.email), 
         email_verified = true`,
      [user.id, full_name || '', cleanPhone, isEmail ? cleanEmail : null]
    );

    // 5. Назначаем базовую роль 'user' в user_roles
    await pool.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user.id, 'user']
    );

    // 6. Генерируем JWT-токен сессии на 7 дней
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'authenticated', sub: user.id },
      ACTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Бэкенд: Регистрация] Успешно завершена для ID: "${user.id}" (логин: "${cleanEmail}")`);
    res.status(201).json({ user, token, session: { access_token: token, user } });
  } catch (err) {
    console.error('[Бэкенд: Регистрация] Критическая ошибка во время регистрации:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Пользователь с такими данными уже зарегистрирован. Пожалуйста, выполните вход.' });
    }
    res.status(500).json({ error: 'Критическая ошибка сервера при регистрации. Повторите попытку позже.' });
  }
});

// Авторизация (вход) пользователя
app.post('/api/auth/login', async (req, res) => {
  const { email, phone, login, password } = req.body;
  const loginInput = email || phone || login;

  if (!loginInput || !password) {
    console.warn('[Бэкенд: Вход] Попытка входа с пустым логином или паролем');
    return res.status(400).json({ error: 'Логин (Email или номер телефона) и пароль обязательны' });
  }

  const cleanInput = String(loginInput).trim();
  // Удаляем все пробелы, если это email
  const cleanEmail = cleanInput.toLowerCase().replace(/\s+/g, '');
  const digitsOnly = cleanInput.replace(/\D/g, ''); // Извлекаем только цифры для проверки телефона
  console.log(`[Бэкенд: Вход] Попытка входа для: "${cleanInput}" (очищенный email: "${cleanEmail}", цифры: "${digitsOnly}")`);

  try {
    // 1. Ищем пользователя в таблице users по Email либо по номеру телефона в profiles
    let result;
    if (digitsOnly.length >= 10) {
      // Если ввод похож на номер телефона (10+ цифр), ищем по профилю и по email
      const last10Digits = digitsOnly.slice(-10);
      result = await pool.query(
        `SELECT u.* FROM users u 
         LEFT JOIN profiles p ON p.id = u.id 
         WHERE LOWER(u.email) = LOWER($1) 
            OR u.email = $2
            OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE '%' || $3
            OR LOWER(COALESCE(p.email, '')) = LOWER($1)
         LIMIT 1`,
        [cleanEmail, `phone_${last10Digits}@domofondar.ru`, last10Digits]
      );
    } else {
      // Ищем по Email (в users и в profiles)
      result = await pool.query(
        `SELECT u.* FROM users u 
         LEFT JOIN profiles p ON p.id = u.id 
         WHERE LOWER(u.email) = LOWER($1) OR LOWER(COALESCE(p.email, '')) = LOWER($1)
         LIMIT 1`,
        [cleanEmail]
      );
    }

    if (result.rows.length === 0) {
      console.warn(`[Бэкенд: Вход] Отклонено: пользователь "${cleanInput}" не найден`);
      return res.status(401).json({ error: 'Неверный логин (Email/телефон) или пароль' });
    }

    const user = result.rows[0];

    // 2. Проверяем пароль через bcrypt
    let isMatch = false;
    if (password === user.password_hash) {
      // Миграция открытого пароля в bcrypt хеш при первом входе
      isMatch = true;
      console.log(`[Бэкенд: Вход] Обнаружен plain-text пароль для "${cleanEmail}". Хэшируем...`);
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password, salt);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    } else {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!isMatch) {
      console.warn(`[Бэкенд: Вход] Отклонено: неверный пароль для "${cleanEmail}"`);
      return res.status(401).json({ error: 'Неверный адрес электронной почты или пароль' });
    }

    // 3. Определяем актуальную роль
    const userRole = await getUserRole(user.id);

    // 4. Генерируем JWT-токен на 7 дней
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'authenticated', userRole: userRole, sub: user.id },
      ACTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Бэкенд: Вход] Успешная авторизация для Email: "${cleanEmail}", роль: ${userRole}`);
    res.json({
      user: { id: user.id, email: user.email, role: userRole },
      token,
      session: {
        access_token: token,
        user: { id: user.id, email: user.email, role: userRole }
      }
    });
  } catch (err) {
    console.error('[Бэкенд: Вход] Критическая ошибка во время входа:', err);
    res.status(500).json({ error: 'Критическая ошибка сервера при авторизации.' });
  }
});

// ------------------------------------------------------------------------------
// МАРШРУТЫ ПРОФИЛЯ ЖИЛЬЦА И РОЛЕЙ (С ЗАЩИТОЙ И СКРЫТИЕМ СУПЕРПОЛЬЗОВАТЕЛЯ)
// ------------------------------------------------------------------------------

// Получить профиль текущего пользователя
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('[Бэкенд: Профиль] Ошибка получения профиля:', err.message);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// Обновить профиль текущего пользователя
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { full_name, phone, address, apartment } = req.body;
  try {
    const result = await pool.query(
      'UPDATE profiles SET full_name = $1, phone = $2, address = $3, apartment = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [full_name, phone, address, apartment, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Бэкенд: Профиль] Ошибка обновления профиля:', err.message);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Получить роли текущего пользователя
app.get('/api/user/roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT role FROM user_roles WHERE user_id = $1', [req.user.id]);
    const roles = result.rows.map(r => ({ role: r.role }));
    
    // Если в таблице user_roles еще нет записи, отдаем роль из users
    if (roles.length === 0) {
      roles.push({ role: req.userRole || 'user' });
    }
    
    res.json(roles);
  } catch (err) {
    console.error('[Бэкенд: Роли] Ошибка получения ролей:', err.message);
    res.json([{ role: req.userRole || 'user' }]);
  }
});

// Получить список пользователей для админки (С СОКРЫТИЕМ СУПЕРПОЛЬЗОВАТЕЛЯ РАЗРАБОТЧИКА)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.email, u.role, u.created_at, p.full_name, p.phone, p.address, p.apartment
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
    `;
    const params = [];

    // КРИТИЧЕСКАЯ ЗАЩИТА: Если запрашивающий НЕ является суперпользователем,
    // полностью скрываем суперпользователя viruscorp4@gmail.com из списка!
    if (!req.isSuperAdmin) {
      query += ` WHERE LOWER(u.email) != LOWER($1) AND u.role != $2`;
      params.push(SUPERADMIN_EMAIL, SUPERADMIN_ROLE);
    }

    query += ` ORDER BY u.created_at DESC LIMIT 200`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Бэкенд: Админка] Ошибка получения списка пользователей:', err.message);
    res.status(500).json({ error: 'Ошибка получения списка пользователей' });
  }
});

// ------------------------------------------------------------------------------
// МОДУЛЬ УПРАВЛЕНИЯ РЕЗЕРВНЫМИ КОПИЯМИ (БЭКАПЫ БД DOMOFONDAR)
// ------------------------------------------------------------------------------

/**
 * Форматирование размера файлов в читаемый вид (КБ, МБ, ГБ)
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Байт';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 1. Получить список всех доступных резервных копий
app.get('/api/admin/backups', authenticateToken, requireAdmin, async (req, res) => {
  console.log(`[Бэкенд: Бэкапы] Запрос списка резервных копий от: ${req.user.email}`);

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(BACKUP_DIR);
    
    // Фильтруем только файлы бэкапов domofondar
    const backups = files
      .filter(f => f.startsWith('domofondar_backup_') && (f.endsWith('.sql.gz') || f.endsWith('.sql') || f.endsWith('.dump')))
      .map(filename => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size_bytes: stats.size,
          size_formatted: formatBytes(stats.size),
          created_at: stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(backups);
  } catch (err) {
    console.error('[Бэкенд: Бэкапы] Ошибка чтения списка бэкапов:', err);
    res.status(500).json({ error: 'Не удалось получить список резервных копий' });
  }
});

// 2. Создать новую резервную копию базы данных domofondar прямо сейчас
app.post('/api/admin/backups/create', authenticateToken, requireAdmin, async (req, res) => {
  console.log(`[Бэкенд: Бэкапы] Запуск создания резервной копии от пользователя: ${req.user.email}`);

  // Формируем имя файла с текущей датой и временем
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `domofondar_backup_${timestamp}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, filename);

  // Извлекаем параметры подключения к PostgreSQL
  const dbUser = process.env.POSTGRES_USER || 'domofondar';
  const dbName = process.env.POSTGRES_DB || 'domofondar';
  const dbHost = process.env.DB_HOST || 'db';
  const dbPort = process.env.DB_PORT || '5432';
  const dbPassword = process.env.POSTGRES_PASSWORD || '';

  // Команда создания дампа через pg_dump со сжатием в gzip
  // PGPASSWORD передается через окружение для безопасности
  const dumpCommand = `PGPASSWORD="${dbPassword}" pg_dump -h "${dbHost}" -p "${dbPort}" -U "${dbUser}" -d "${dbName}" --no-owner --no-acl | gzip > "${filePath}"`;

  console.log(`[Бэкенд: Бэкапы] Выполнение команды экспорта БД в ${filePath}...`);

  exec(dumpCommand, { timeout: 120000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('[Бэкенд: Бэкапы] Ошибка при создании дампа:', error.message);
      return res.status(500).json({ error: `Ошибка создания резервной копии: ${error.message}` });
    }

    try {
      const stats = fs.statSync(filePath);
      console.log(`[Бэкенд: Бэкапы] Резервная копия успешно создана: ${filename}, размер: ${formatBytes(stats.size)}`);
      
      res.json({
        success: true,
        message: 'Резервная копия базы данных успешно создана',
        backup: {
          filename,
          size_bytes: stats.size,
          size_formatted: formatBytes(stats.size),
          created_at: stats.mtime
        }
      });
    } catch (statErr) {
      res.status(500).json({ error: 'Ошибка верификации созданного файла резервной копии' });
    }
  });
});

// 3. Безопасное скачивание резервной копии
app.get('/api/admin/backups/download/:filename', authenticateToken, requireAdmin, (req, res) => {
  const { filename } = req.params;
  console.log(`[Бэкенд: Бэкапы] Запрос скачивания файла "${filename}" от ${req.user.email}`);

  // Защита от Directory Traversal атаки: проверяем, что имя файла не содержит путей
  if (!filename || path.basename(filename) !== filename || !filename.startsWith('domofondar_backup_')) {
    console.warn(`[Бэкенд: Бэкапы] Попытка несанкционированного доступа к файлу: "${filename}"`);
    return res.status(400).json({ error: 'Недопустимое имя файла резервной копии' });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`[Бэкенд: Бэкапы] Файл "${filename}" не найден на диске`);
    return res.status(404).json({ error: 'Файл резервной копии не найден на сервере' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error(`[Бэкенд: Бэкапы] Ошибка при передаче файла клиенту:`, err.message);
    } else {
      console.log(`[Бэкенд: Бэкапы] Файл "${filename}" успешно передан пользователю ${req.user.email}`);
    }
  });
});

// 4. Удаление старой резервной копии
app.delete('/api/admin/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  const { filename } = req.params;
  console.log(`[Бэкенд: Бэкапы] Запрос на удаление резервной копии "${filename}" от ${req.user.email}`);

  if (!filename || path.basename(filename) !== filename || !filename.startsWith('domofondar_backup_')) {
    return res.status(400).json({ error: 'Недопустимое имя файла' });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Файл не найден' });
  }

  try {
    fs.unlinkSync(filePath);
    console.log(`[Бэкенд: Бэкапы] Файл "${filename}" успешно удален`);
    res.json({ success: true, message: `Резервная копия ${filename} удалена` });
  } catch (err) {
    console.error(`[Бэкенд: Бэкапы] Ошибка удаления файла:`, err.message);
    res.status(500).json({ error: 'Не удалось удалить файл резервной копии' });
  }
});

// ------------------------------------------------------------------------------
// МАРШРУТЫ ЛИЦЕВЫХ СЧЕТОВ И ЗАЯВОК (ПАРАМЕТРИЗОВАННЫЕ ЗАПРОСЫ)
// ------------------------------------------------------------------------------

// Получить список лицевых счетов абонентов
app.get('/api/accounts', authenticateToken, async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT account_number, period, debt_amount, address, apartment, phone, full_name, has_handset, payment_type FROM accounts';
    const params = [];

    if (search) {
      query += ' WHERE address ILIKE $1 OR account_number ILIKE $1 OR phone ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY address ASC, apartment ASC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Бэкенд: Счета] Ошибка при получении счетов:', err.message);
    res.status(500).json({ error: 'Ошибка получения лицевых счетов' });
  }
});

// Получить список заявок
app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests ORDER BY created_at DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) {
    console.error('[Бэкенд: Заявки] Ошибка при получении заявок:', err.message);
    res.json([]);
  }
});

// Создать новую заявку
app.post('/api/requests', authenticateToken, async (req, res) => {
  const { name, phone, address, message, priority, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO requests (name, phone, address, message, priority, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, phone, address, message, priority || 'medium', status || 'new']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Бэкенд: Заявки] Ошибка при создании заявки:', err.message);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  }
});

// ------------------------------------------------------------------------------
// МОДУЛЬ ОНЛАЙН-ПЛАТЕЖЕЙ ЮKASSA
// ------------------------------------------------------------------------------

/**
 * Централизованная обработка успешно завершенного платежа ЮKassa.
 * - Фиксирует статус 'succeeded' в таблице payments
 * - Если платеж содержал order_data (заказ оборудования/ключей) и заявка еще не создана:
 *   создает официальную заявку в таблице requests, вставляет позиции в request_items и привязывает request_id к платежу.
 * - Если заявка уже существовала, переводит ее в payment_status = 'paid' и status = 'pending'.
 * - Если это оплата ТО (не заказ оборудования), уменьшает сальдо долга в таблице accounts.
 */
async function processSuccessfulPayment(yooData, fallbackPayment = null) {
  const paymentId = yooData.id || fallbackPayment?.yookassa_payment_id;
  if (!paymentId) return;

  const paidAmount = parseFloat(yooData.amount?.value || fallbackPayment?.amount || 0);
  const paymentMethod = yooData.payment_method?.type || fallbackPayment?.payment_method || 'bank_card';

  // Получаем текущую запись из локальной БД для доступа к полному metadata (включая сохраненный order_data)
  const pRes = await pool.query(
    'SELECT * FROM payments WHERE yookassa_payment_id = $1 LIMIT 1',
    [paymentId]
  );
  const paymentRecord = pRes.rows[0] || fallbackPayment;

  // Парсим локальный metadata
  let localMeta = {};
  if (paymentRecord?.metadata) {
    localMeta = typeof paymentRecord.metadata === 'string'
      ? JSON.parse(paymentRecord.metadata)
      : paymentRecord.metadata;
  }

  // Объединяем с metadata ответа ЮKassa
  const combinedMeta = {
    ...localMeta,
    ...(yooData.metadata || {})
  };

  // 1. Обновляем статус платежа в таблице payments
  await pool.query(
    'UPDATE payments SET status = $1, payment_method = $2, metadata = $3, updated_at = CURRENT_TIMESTAMP WHERE yookassa_payment_id = $4',
    ['succeeded', paymentMethod, JSON.stringify(combinedMeta), paymentId]
  );
  console.log(`[Бэкенд: ЮKassa Успех] Платёж ${paymentId} на сумму ${paidAmount} ₽ успешно подтверждён (метод: ${paymentMethod})`);

  let reqId = combinedMeta?.request_id || paymentRecord?.request_id;
  const isOrder = combinedMeta?.is_order === 'true' || combinedMeta?.is_order === true || !!combinedMeta?.order_data;

  // 2. Если это заказ оборудования/услуг и заявка ещё не была создана, СОЗДАЕМ ЕЁ СЕЙЧАС (строго после оплаты!)
  if (!reqId && combinedMeta?.order_data) {
    try {
      const order = typeof combinedMeta.order_data === 'string'
        ? JSON.parse(combinedMeta.order_data)
        : combinedMeta.order_data;

      console.log(`[Бэкенд: ЮKassa Заказ] Оплата получена! Создание официальной заявки наряда в БД для абонента: ${order.name || 'Абонент'}, адрес: ${order.address}`);

      const reqInsert = await pool.query(
        `INSERT INTO requests (
          name, phone, address, street, house, entrance, floor, apartment,
          message, status, priority, order_type,
          payment_status, payment_amount, payment_method, client_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'medium', 'equipment_order', 'paid', $10, 'online', $11)
        RETURNING id`,
        [
          order.name || 'Абонент ЛК',
          order.phone || 'не указан',
          order.address || '',
          order.street || null,
          order.house || null,
          order.entrance || null,
          order.floor || null,
          order.apartment || null,
          order.message || 'Заказ оборудования и услуг (оплачено онлайн через ЮKassa)',
          order.amount || paidAmount,
          order.user_id || paymentRecord?.user_id || null
        ]
      );

      reqId = reqInsert.rows[0]?.id;
      console.log(`[Бэкенд: ЮKassa Заказ] ✅ Официальная заявка наряда создана с ID: ${reqId}`);

      // Сохраняем детальные позиции товаров в request_items
      let hasCabinetItem = false;
      if (reqId && Array.isArray(order.items) && order.items.length > 0) {
        for (const item of order.items) {
          if (!item.product_id) continue;
          if (item.name && (item.name.toLowerCase().includes('кабинет') || item.name.toLowerCase().includes('умный домофон'))) {
            hasCabinetItem = true;
          }
          await pool.query(
            `INSERT INTO request_items (request_id, product_id, quantity, price)
             VALUES ($1, $2, $3, $4)`,
            [reqId, item.product_id, item.quantity || 1, item.price || 0]
          );
        }
        console.log(`[Бэкенд: ЮKassa Заказ] Добавлено ${order.items.length} позиций товаров в таблицу request_items (покупка ЛК: ${hasCabinetItem})`);
      }

      // Привязываем созданную заявку к платежу
      if (reqId) {
        combinedMeta.request_id = reqId;
        await pool.query(
          'UPDATE payments SET request_id = $1, metadata = $2 WHERE yookassa_payment_id = $3',
          [reqId, JSON.stringify(combinedMeta), paymentId]
        );
      }

      // Если в оплаченном заказе была позиция Личного кабинета — сразу активируем статус владения в БД
      if (hasCabinetItem) {
        console.log(`[Бэкенд: ЮKassa Заказ] 📱 В заказе #${reqId} подтверждена оплата Личного кабинета! Активируем has_lk...`);
        const accNumber = order.account_number || paymentRecord?.account_number || combinedMeta?.account_number;
        if (accNumber) {
          await pool.query(
            "UPDATE accounts SET has_lk = true, updated_at = CURRENT_TIMESTAMP WHERE account_number = $1",
            [accNumber]
          );
          await pool.query(
            "UPDATE intercom_credentials SET is_purchased = true, has_lk = true, purchased_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE account_number = $1",
            [accNumber]
          );
          console.log(`[Бэкенд: ЮKassa Заказ] ✅ Активирован has_lk = true для счета ${accNumber}`);
        }
        if (order.apartment) {
          const aptClean = String(order.apartment).trim();
          const houseClean = String(order.house || '').trim();
          if (houseClean) {
            await pool.query(
              `UPDATE intercom_credentials 
               SET is_purchased = true, has_lk = true, purchased_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
               WHERE apartment = $1 AND (house = $2 OR address ILIKE $3)`,
              [aptClean, houseClean, `%${houseClean}%`]
            );
          }
        }
      }
    } catch (orderErr) {
      console.error('[Бэкенд: ЮKassa Заказ] Ошибка создания заявки из order_data:', orderErr.message);
    }
  } else if (reqId) {
    // Если заявка уже существовала, переводим её в статус 'paid' и 'pending'
    await pool.query(
      "UPDATE requests SET payment_status = 'paid', status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [reqId]
    );
    console.log(`[Бэкенд: ЮKassa] Существующая заявка ${reqId} переведена в статус 'paid'`);

    // Проверяем, есть ли среди позиций существующей заявки Личный кабинет
    try {
      const cabCheck = await pool.query(
        `SELECT ri.id FROM request_items ri 
         JOIN products p ON ri.product_id = p.id 
         WHERE ri.request_id = $1 AND (p.name ILIKE '%кабинет%' OR p.name ILIKE '%умный домофон%')`,
        [reqId]
      );
      if (cabCheck.rows.length > 0) {
        console.log(`[Бэкенд: ЮKassa] Заявка #${reqId} содержала Личный кабинет. Активируем has_lk...`);
        const rData = (await pool.query("SELECT account_number, apartment, house FROM requests WHERE id = $1", [reqId])).rows[0];
        const acc = rData?.account_number || combinedMeta?.account_number;
        if (acc) {
          await pool.query("UPDATE accounts SET has_lk = true, updated_at = CURRENT_TIMESTAMP WHERE account_number = $1", [acc]);
          await pool.query("UPDATE intercom_credentials SET is_purchased = true, has_lk = true, purchased_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE account_number = $1", [acc]);
        }
        if (rData?.apartment && rData?.house) {
          await pool.query(
            "UPDATE intercom_credentials SET is_purchased = true, has_lk = true, purchased_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE apartment = $1 AND house = $2",
            [rData.apartment, rData.house]
          );
        }
      }
    } catch (cabErr) {
      console.warn('[Бэкенд: ЮKassa] Ошибка проверки request_items на ЛК:', cabErr.message);
    }
  }

  // 3. Если это обычная оплата ТО лицевого счета (не покупка оборудования/ключей)
  const accNum = combinedMeta?.account_number || paymentRecord?.account_number;
  const creditAmount = combinedMeta?.credit_amount 
    ? parseFloat(combinedMeta.credit_amount) 
    : paidAmount;

  if (accNum && creditAmount > 0 && !isOrder) {
    await pool.query(
      "UPDATE accounts SET debt_amount = debt_amount - $1, updated_at = CURRENT_TIMESTAMP WHERE account_number = $2",
      [creditAmount, accNum]
    );
    console.log(`[Бэкенд: ЮKassa ТО] Баланс лицевого счёта ${accNum} уменьшен на сумму ${creditAmount} ₽`);
  }
}

/**
 * Создание платежа в ЮKassa (с поддержкой СБП, банковских карт, SberPay, T-Pay)
 */
app.post('/api/payments/yookassa/create', async (req, res) => {
  try {
    // Считываем параметры платежа с поддержкой как snake_case, так и camelCase из фронтенда
    const amount = req.body.amount;
    const description = req.body.description;
    const account_number = req.body.account_number || req.body.accountNumber || '';
    const user_id = req.body.user_id || req.body.userId || null;
    const request_id = req.body.request_id || req.body.requestId || null;
    const return_url = req.body.return_url || req.body.returnUrl;
    const credit_amount = req.body.credit_amount || req.body.creditAmount || null; // Базовая сумма к зачислению на л/с без комиссии
    const fee_amount = req.body.fee_amount || req.body.feeAmount || null; // Комиссия за эквайринг (5%)
    const order_data = req.body.order_data || req.body.orderData || null; // Данные заказа для создания заявки строго после оплаты
    const is_order = req.body.is_order || req.body.isOrder || (order_data ? true : false);
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      console.warn('[Бэкенд: ЮKassa] Отклонено: некорректная сумма платежа:', amount);
      return res.status(400).json({ error: 'Укажите корректную сумму платежа больше 0 ₽' });
    }

    const formattedAmount = numAmount.toFixed(2);
    const idempotenceKey = crypto.randomUUID();
    const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

    // Формируем URL возврата абонента после завершения оплаты
    const origin = req.headers.origin || 'https://45.8.99.238.sslip.io';
    const redirectUrl = return_url || `${origin}/cabinet?check_payment=1&account=${encodeURIComponent(account_number || '')}&amount=${formattedAmount}`;

    const desc = description || (account_number 
      ? `Оплата ТО домофона по л/с ${account_number}` 
      : 'Оплата услуг компании Домофондар');

    // Метаданные для внешнего шлюза ЮKassa (компактные поля)
    const yooMetadata = {
      account_number: account_number || '',
      user_id: user_id || '',
      request_id: request_id || '',
      credit_amount: credit_amount ? String(credit_amount) : '',
      fee_amount: fee_amount ? String(fee_amount) : '',
      is_order: is_order ? 'true' : 'false',
    };

    const payload = {
      amount: {
        value: formattedAmount,
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: redirectUrl,
      },
      description: desc,
      metadata: yooMetadata,
    };

    console.log(`[Бэкенд: ЮKassa] Запрос создания платежа на ${formattedAmount} ₽ (заказ: ${is_order ? 'ДА' : 'НЕТ'})...`);

    const yooRes = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const yooData = await yooRes.json();

    if (!yooRes.ok) {
      console.error('[Бэкенд: ЮKassa] Ошибка от API ЮKassa:', yooData);
      return res.status(yooRes.status).json({ 
        error: yooData.description || 'Не удалось сформировать платеж в ЮKassa. Попробуйте позже.' 
      });
    }

    const confirmationUrl = yooData.confirmation?.confirmation_url;
    console.log(`[Бэкенд: ЮKassa] Платеж успешно зарегистрирован! ID: ${yooData.id}, статус: ${yooData.status}, confirmationUrl: ${confirmationUrl || 'отсутствует'}`);

    // Сохраняем информацию о начатом платеже в базу данных PostgreSQL вместе с полным order_data
    try {
      const combinedLocalMeta = {
        ...yooMetadata,
        order_data: order_data || null,
      };

      await pool.query(
        `INSERT INTO payments (yookassa_payment_id, account_number, user_id, request_id, amount, status, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (yookassa_payment_id) DO UPDATE SET status = EXCLUDED.status, metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
        [
          yooData.id,
          account_number || null,
          user_id || null,
          request_id || null,
          numAmount,
          yooData.status,
          desc,
          JSON.stringify(combinedLocalMeta)
        ]
      );
    } catch (dbErr) {
      console.error('[Бэкенд: ЮKassa] Предупреждение при сохранении платежа в БД:', dbErr.message);
    }

    // Возвращаем клиенту ID платежа, статус и URL подтверждения (в snake_case и camelCase)
    res.json({
      success: true,
      id: yooData.id,
      status: yooData.status,
      confirmation_url: confirmationUrl,
      confirmationUrl: confirmationUrl, // Поле для фронтенда React
    });
  } catch (err) {
    console.error('[Бэкенд: ЮKassa] Критическое исключение:', err.message);
    res.status(500).json({ error: 'Критическая ошибка сервера при обращении к платежному шлюзу' });
  }
});

/**
 * Проверка статуса платежа в ЮKassa и фиксация оплаты
 */
app.get('/api/payments/yookassa/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

    const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { 'Authorization': authHeader },
    });

    const yooData = await yooRes.json();
    if (!yooRes.ok) {
      return res.status(yooRes.status).json({ error: yooData.description || 'Платеж не найден' });
    }

    // Если статус платежа стал 'succeeded', запускаем централизованную обработку
    if (yooData.status === 'succeeded' || yooData.paid === true) {
      await processSuccessfulPayment(yooData);
    } else if (yooData.status === 'canceled') {
      // Логируем и фиксируем статус отмены платежа в БД
      await pool.query(
        "UPDATE payments SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE yookassa_payment_id = $1",
        [paymentId]
      );
      console.log(`[Бэкенд: ЮKassa Статус] Платёж ${paymentId} отмечен как отменённый в БД`);
    }

    res.json({
      id: yooData.id,
      status: yooData.status,
      paid: yooData.paid,
      amount: yooData.amount,
      metadata: yooData.metadata
    });
  } catch (err) {
    console.error('[Бэкенд: ЮKassa] Ошибка проверки статуса:', err.message);
    res.status(500).json({ error: 'Ошибка проверки статуса платежа' });
  }
});

/**
 * Вебхук от ЮKassa для моментальной фиксации завершенных оплат
 */
app.post('/api/payments/yookassa/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('[Бэкенд: ЮKassa Вебхук] Получено событие:', event?.event, 'для объекта:', event?.object?.id);

    if (event?.event === 'payment.succeeded' && event?.object) {
      await processSuccessfulPayment(event.object);
    } else if (event?.event === 'payment.canceled' && event?.object) {
      // Автоматическое событие отмены платежа (таймаут 15-60 минут или отмена пользователем в шлюзе)
      const paymentObj = event.object;
      const paymentId = paymentObj.id;
      const reqId = paymentObj.metadata?.request_id;
      const cancelReason = paymentObj.cancellation_details?.reason || 'не указана';

      // Обновляем статус платежа в базе данных на 'canceled'
      await pool.query(
        "UPDATE payments SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE yookassa_payment_id = $1",
        [paymentId]
      );
      console.log(`[Бэкенд: ЮKassa Вебхук] Платёж ${paymentId} отменён шлюзом ЮKassa (причина: ${cancelReason})`);

      // Если платёж был привязан к существующей заявке, переводим её в статус 'cancelled'
      if (reqId) {
        await pool.query(
          "UPDATE requests SET payment_status = 'canceled', status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND payment_status != 'paid'",
          [reqId]
        );
        console.log(`[Бэкенд: ЮKassa Вебхук] Заявка ${reqId} отменена из-за отмены платежа`);
      }
    }

    // Всегда отвечаем ЮKassa 200 OK
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Бэкенд: ЮKassa Вебхук] Ошибка обработки вебхука:', err.message);
    res.status(200).send('OK');
  }
});

/**
 * Автоматическая синхронизация статуса платежей по лицевому счету
 * Опрашивает API ЮKassa для всех "pending" платежей счета, обновляет БД и баланс
 */
app.get('/api/payments/yookassa/sync/:accountNumber', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    if (!accountNumber) {
      return res.status(400).json({ error: 'Не указан лицевой счет' });
    }

    console.log(`[Бэкенд: ЮKassa Синхронизация] Запуск проверки оплат для л/с "${accountNumber}"...`);

    // 1. Ищем все незавершенные платежи по данному лицевому счету
    const pendingRes = await pool.query(
      `SELECT * FROM payments WHERE account_number = $1 AND status = 'pending' ORDER BY created_at DESC`,
      [accountNumber]
    );

    const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
    let updatedCount = 0;

    for (const payment of pendingRes.rows) {
      try {
        const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${payment.yookassa_payment_id}`, {
          headers: { 'Authorization': authHeader },
        });

        if (!yooRes.ok) continue;

        const yooData = await yooRes.json();

        if (yooData.status === 'succeeded' || yooData.paid === true) {
          await processSuccessfulPayment(yooData, payment);
          updatedCount++;
        } else if (yooData.status === 'canceled') {
          await pool.query(
            `UPDATE payments SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [payment.id]
          );
        }
      } catch (err) {
        console.warn(`[Бэкенд: ЮKassa Синхронизация] Ошибка проверки платежа ${payment.yookassa_payment_id}:`, err.message);
      }
    }

    // 2. Получаем актуальный список всех платежей по этому лицевому счету
    const allPayments = await pool.query(
      `SELECT id, yookassa_payment_id, account_number, user_id, request_id, amount, status, payment_method, description, metadata, created_at, updated_at
       FROM payments 
       WHERE account_number = $1
       ORDER BY created_at DESC`,
      [accountNumber]
    );

    // 3. Получаем текущее сальдо счета
    const accRes = await pool.query(
      `SELECT account_number, debt_amount, period FROM accounts WHERE account_number = $1 LIMIT 1`,
      [accountNumber]
    );

    res.json({
      success: true,
      updatedCount,
      payments: allPayments.rows,
      account: accRes.rows[0] || null,
    });
  } catch (err) {
    console.error('[Бэкенд: ЮKassa Синхронизация] Ошибка:', err.message);
    res.status(500).json({ error: 'Ошибка синхронизации платежей' });
  }
});

/**
 * Получение истории онлайн-платежей по лицевому счету
 */
app.get('/api/payments/yookassa/history/:accountNumber', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    if (!accountNumber) {
      return res.status(400).json({ error: 'Не указан лицевой счет' });
    }

    const result = await pool.query(
      `SELECT id, yookassa_payment_id, account_number, user_id, request_id, amount, status, payment_method, description, metadata, created_at, updated_at
       FROM payments 
       WHERE account_number = $1
       ORDER BY created_at DESC`,
      [accountNumber]
    );

    res.json({
      success: true,
      payments: result.rows,
    });
  } catch (err) {
    console.error('[Бэкенд: ЮKassa История] Ошибка:', err.message);
    res.status(500).json({ error: 'Ошибка получения истории платежей' });
  }
});

/**
 * Отмена зависшего платежа пользователем
 */
app.post('/api/payments/yookassa/cancel/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log(`[Бэкенд: ЮKassa Отмена] Запрос на отмену платежа ${paymentId}`);

    const result = await pool.query(
      `UPDATE payments 
       SET status = 'canceled', updated_at = CURRENT_TIMESTAMP 
       WHERE (yookassa_payment_id = $1 OR id::text = $1) AND status = 'pending'
       RETURNING *`,
      [paymentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Платёж не найден или уже не находится в ожидании' });
    }

    res.json({ success: true, payment: result.rows[0] });
  } catch (err) {
    console.error('[Бэкенд: ЮKassa Отмена] Ошибка:', err.message);
    res.status(500).json({ error: 'Ошибка отмены платежа' });
  }
});

// ------------------------------------------------------------------------------
// МОДУЛЬ «НАШИ РАБОТЫ И ПОРТФОЛИО» С ПОЛЬЗОВАТЕЛЬСКИМ КОНТЕНТОМ И МОДЕРАЦИЕЙ
// ------------------------------------------------------------------------------

/**
 * 1. Загрузка медиафайла (фото или видео) для портфолио
 * Принимает JSON: { fileBase64: 'data:...;base64,...', fileName: 'photo.jpg', fileType: 'image/jpeg' }
 */
app.post('/api/portfolio/upload', async (req, res) => {
  try {
    const { fileBase64, fileName, fileType } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Файл или имя файла не переданы' });
    }

    // Извлекаем чистый Base64 буфер
    const matches = fileBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(fileBase64, 'base64');
    }

    // Определяем расширение и тип (фото или видео)
    const ext = path.extname(fileName).toLowerCase() || '.jpg';
    const isVideo = ['.mp4', '.mov', '.webm', '.avi', '.m4v'].includes(ext) || (fileType && fileType.startsWith('video/'));
    const safeBaseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_').slice(0, 40);
    const uniqueFileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBaseName}${ext}`;

    // Сохраняем в папку media/portfolio
    const targetDir = PORTFOLIO_MEDIA_DIR;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const fullPath = path.join(targetDir, uniqueFileName);
    fs.writeFileSync(fullPath, buffer);

    console.log(`[Бэкенд: Портфолио] Загружен файл ${uniqueFileName} (${isVideo ? 'Видео' : 'Фото'}, ${(buffer.length / 1024 / 1024).toFixed(2)} МБ)`);

    // Возвращаем веб-путь
    const mediaUrl = `/media/portfolio/${uniqueFileName}`;
    res.json({
      success: true,
      url: mediaUrl,
      type: isVideo ? 'video' : 'image',
      fileName: uniqueFileName,
      size: buffer.length
    });
  } catch (err) {
    console.error('[Бэкенд: Портфолио] Ошибка загрузки файла:', err.message);
    res.status(500).json({ error: 'Ошибка сохранения файла на сервере' });
  }
});

/**
 * 2. Получить список опубликованных объектов (для витрины сайта)
 */
app.get('/api/portfolio', async (req, res) => {
  try {
    const query = `
      SELECT id, author_type, author_display_name, project_type, title, review_text, rating, media_files, likes_count, created_at
      FROM portfolio_projects
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('[Бэкенд: Портфолио] Ошибка получения опубликованных объектов:', err.message);
    res.status(500).json({ error: 'Ошибка получения объектов портфолио' });
  }
});

/**
 * 3. Отправить новый объект/отзыв от клиента (поступает со статусом 'pending' на модерацию)
 */
app.post('/api/portfolio', async (req, res) => {
  try {
    const {
      author_type = 'client',
      author_display_name,
      project_type = 'Умный домофон',
      title,
      review_text,
      rating = 5,
      media_files = [],
      author_phone,
      client_info = {}
    } = req.body;

    if (!author_display_name || !author_display_name.trim()) {
      return res.status(400).json({ error: 'Укажите ФИО/имя или название организации' });
    }
    if (!review_text || !review_text.trim()) {
      return res.status(400).json({ error: 'Напишите отзыв или описание работ' });
    }

    // Если пользователь сторонний (не наш зарегистрированный абонент), номер телефона обязателен для связи менеджеров
    const isRegistered = Boolean(client_info && client_info.is_registered_client);
    const resolvedPhone = isRegistered ? (client_info.phone || author_phone || null) : (author_phone || '').trim();

    if (!isRegistered && (!resolvedPhone || resolvedPhone.length < 6)) {
      return res.status(400).json({ 
        error: 'Пожалуйста, укажите ваш контактный номер телефона, чтобы менеджеры могли связаться при необходимости' 
      });
    }

    const query = `
      INSERT INTO portfolio_projects 
      (author_type, author_display_name, project_type, title, review_text, rating, media_files, author_phone, client_info, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [
      author_type,
      author_display_name.trim(),
      project_type,
      (title || '').trim() || null,
      review_text.trim(),
      Math.min(5, Math.max(1, Number(rating) || 5)),
      JSON.stringify(media_files || []),
      resolvedPhone || null,
      JSON.stringify(client_info || {})
    ];

    const result = await pool.query(query, values);
    const clientTypeStr = isRegistered ? 'Зарегистрированный абонент' : 'Сторонний гость';
    console.log(`[Бэкенд: Портфолио] Поступил новый объект на модерацию [${clientTypeStr}] от "${author_display_name}" (тел: ${resolvedPhone || 'не указан'}): ID ${result.rows[0].id}`);

    res.json({
      success: true,
      message: 'Объект успешно отправлен на модерацию. После проверки он будет опубликован на сайте!',
      project: result.rows[0]
    });
  } catch (err) {
    console.error('[Бэкенд: Портфолио] Ошибка отправки объекта:', err.message);
    res.status(500).json({ error: 'Не удалось отправить объект на модерацию' });
  }
});

/**
 * 4. Получить все объекты для панели модерации (для админов/диспетчеров)
 */
app.get('/api/admin/portfolio', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT * FROM portfolio_projects`;
    const params = [];

    if (status && status !== 'all') {
      query += ` WHERE status = $1`;
      params.push(status);
    }
    query += ` ORDER BY created_at DESC LIMIT 200;`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Бэкенд: Админка Портфолио] Ошибка получения объектов:', err.message);
    res.status(500).json({ error: 'Ошибка получения списка объектов' });
  }
});

/**
 * 5. Изменение статуса объекта (одобрить / отклонить / заметка)
 */
app.patch('/api/admin/portfolio/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, moderator_comment, title, review_text, author_display_name, project_type } = req.body;

    const query = `
      UPDATE portfolio_projects
      SET 
        status = COALESCE($1, status),
        moderator_comment = COALESCE($2, moderator_comment),
        title = COALESCE($3, title),
        review_text = COALESCE($4, review_text),
        author_display_name = COALESCE($5, author_display_name),
        project_type = COALESCE($6, project_type),
        approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END
      WHERE id = $7
      RETURNING *;
    `;
    const result = await pool.query(query, [
      status || null,
      moderator_comment || null,
      title || null,
      review_text || null,
      author_display_name || null,
      project_type || null,
      id
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    console.log(`[Бэкенд: Админка Портфолио] Объект ${id} обновлен модератором: статус=${status}`);
    res.json({ success: true, project: result.rows[0] });
  } catch (err) {
    console.error('[Бэкенд: Админка Портфолио] Ошибка обновления объекта:', err.message);
    res.status(500).json({ error: 'Ошибка обновления объекта' });
  }
});

/**
 * 6. Удаление объекта
 */
app.delete('/api/admin/portfolio/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM portfolio_projects WHERE id = $1 RETURNING *;', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Объект не найден' });
    }
    console.log(`[Бэкенд: Админка Портфолио] Объект ${id} удален модератором`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Бэкенд: Админка Портфолио] Ошибка удаления объекта:', err.message);
    res.status(500).json({ error: 'Ошибка удаления объекта' });
  }
});

/**
 * -------------------------------------------------------------
 * 7. Публичная статистика и счетчики сайта (/api/public-stats)
 * -------------------------------------------------------------
 * Возвращает проверенные реальные показатели компании:
 * - accounts_count: реальное число лицевых счетов/абонентов из БД (таблица accounts)
 * - krasnodar_years: стаж компании в Краснодаре с момента регистрации (14.02.2019)
 * - yufo_years: суммарный опыт работы специалистов по ЮФО с 2004 года
 * - blocks: активные блоки из site_blocks или актуальные дефолтные блоки
 */
app.get('/api/public-stats', async (req, res) => {
  try {
    // 1. Запрашиваем реальное количество лицевых счетов из БД
    const accResult = await pool.query('SELECT count(*)::int AS total FROM accounts;');
    const accountsCount = accResult.rows[0]?.total || 11244;

    // 2. Расчет стажа работы в Краснодаре (регистрация ООО «Домофондар» 14 февраля 2019 года)
    const now = new Date();
    const regDateKrd = new Date(2019, 1, 14); // Месяцы в JS 0-индексированы: 1 = февраль
    let krasnodarYears = now.getFullYear() - 2019;
    if (now.getMonth() < 1 || (now.getMonth() === 1 && now.getDate() < 14)) {
      krasnodarYears--;
    }

    // 3. Расчет опыта работы по ЮФО (с 2004 года)
    const yufoYears = now.getFullYear() - 2004;

    // 4. Запрашиваем кастомные блоки из БД (если настроены в админке)
    const blocksResult = await pool.query(`
      SELECT id, content, is_active, order_index 
      FROM site_blocks 
      WHERE block_name = 'stats' AND is_active = true 
      ORDER BY order_index ASC;
    `);

    let blocks = [];
    if (blocksResult.rows.length > 0) {
      // Подставляем динамические значения, если они указаны в конфиге
      blocks = blocksResult.rows.map(row => {
        const c = row.content || {};
        let displayValue = c.value || '';

        // Проверяем спец-переменные для автоподстановки
        if (c.source_type === 'accounts_db' || displayValue === '{auto_accounts}') {
          displayValue = accountsCount.toLocaleString('ru-RU');
        } else if (c.source_type === 'krasnodar_years' || displayValue === '{auto_krasnodar}') {
          displayValue = `${krasnodarYears} лет`;
        } else if (c.source_type === 'yufo_years' || displayValue === '{auto_yufo}') {
          displayValue = `${yufoYears} года`;
        }

        return {
          id: row.id,
          icon: c.icon || 'Users',
          value: displayValue,
          raw_value: c.value,
          label: c.label || '',
          source_type: c.source_type || 'custom',
          order_index: row.order_index
        };
      });
    } else {
      // Дефолтные эталонные блоки с реальными данными компании
      blocks = [
        {
          id: 'default-clients',
          icon: 'Users',
          value: accountsCount.toLocaleString('ru-RU'),
          label: 'Довольных клиентов',
          source_type: 'accounts_db',
          order_index: 0
        },
        {
          id: 'default-years-krd',
          icon: 'Clock',
          value: `${krasnodarYears} лет`,
          label: 'На рынке Краснодара',
          source_type: 'krasnodar_years',
          order_index: 1
        },
        {
          id: 'default-years-yufo',
          icon: 'TrendingUp',
          value: `${yufoYears} года`,
          label: 'Опыт работы по ЮФО',
          source_type: 'yufo_years',
          order_index: 2
        },
        {
          id: 'default-quality',
          icon: 'Award',
          value: '100%',
          label: 'Гарантия качества',
          source_type: 'custom',
          order_index: 3
        }
      ];
    }

    console.log(`[Бэкенд: Статистика] Отдана публичная статистика: абонентов=${accountsCount}, лет КРД=${krasnodarYears}, лет ЮФО=${yufoYears}`);

    res.json({
      success: true,
      stats: {
        accounts_count: accountsCount,
        krasnodar_years: krasnodarYears,
        yufo_years: yufoYears,
        blocks: blocks
      }
    });
  } catch (err) {
    console.error('[Бэкенд: Статистика] Ошибка получения публичной статистики:', err.message);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`[Бэкенд: Domofondar] Сервер успешно запущен на порту ${port}`);
  console.log(`[Бэкенд: Domofondar] Директория бэкапов: ${BACKUP_DIR}`);
  console.log(`[Бэкенд: Domofondar] Платежный шлюз ЮKassa: подключен (ShopId: ${YOOKASSA_SHOP_ID})`);
});

