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
// ПОЛНОЕ (БЕЗВОЗВРАТНОЕ) УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ И ВСЕХ СВЯЗАННЫХ ДАННЫХ
// Используется для удаления тестовых регистраций, чтобы они полностью
// исчезли из статистики вместе со своими платежами. Операция НЕОБРАТИМА.
// ------------------------------------------------------------------------------
app.delete('/api/admin/users/:id/purge', authenticateToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }

  const client = await pool.connect();
  try {
    // Проверяем, что это не суперпользователь-разработчик — его удалять нельзя
    const u = await client.query('SELECT email, role FROM users WHERE id = $1', [userId]);
    if (u.rowCount === 0) {
      client.release();
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const target = u.rows[0];
    if (
      (target.email && target.email.toLowerCase() === String(SUPERADMIN_EMAIL).toLowerCase()) ||
      target.role === SUPERADMIN_ROLE
    ) {
      client.release();
      return res.status(403).json({ error: 'Нельзя удалить суперпользователя' });
    }

    await client.query('BEGIN');
    const counts = {};
    const del = async (label, sql, params) => {
      try {
        const r = await client.query(sql, params);
        counts[label] = r.rowCount;
      } catch (e) {
        // Таблица/колонка может отсутствовать — не прерываем всю операцию
        counts[label] = `skip: ${e.message}`;
      }
    };

    // Порядок важен: сначала зависимые записи, затем сам пользователь
    await del('payments', 'DELETE FROM payments WHERE user_id = $1', [userId]);
    await del('requests', 'DELETE FROM requests WHERE client_id = $1', [userId]);
    await del('push_subscriptions', 'DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
    await del('user_roles', 'DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await del('profiles', 'DELETE FROM profiles WHERE id = $1', [userId]);
    await del('users', 'DELETE FROM users WHERE id = $1', [userId]);
    // Чистим и журнал удалений, чтобы запись исчезла и из вкладки «Удалённые»
    await del('deletion_log', "DELETE FROM deletion_log WHERE entity_type = 'user' AND entity_id = $1", [userId]);

    await client.query('COMMIT');
    console.log(`[Бэкенд: Админка] Полное удаление пользователя ${userId} выполнено:`, counts);
    res.json({ success: true, counts });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Бэкенд: Админка] Ошибка полного удаления пользователя:', err.message);
    res.status(500).json({ error: 'Ошибка полного удаления: ' + err.message });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------------------
// АНКЕТА СОТРУДНИКА: сотрудник заполняет данные о себе и этим активирует назначение.
// Обновляем ТОЛЬКО собственную запись (по user_id из токена) — защита от подмены.
// ------------------------------------------------------------------------------
app.post('/api/employees/complete-profile', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const { full_name, contact_phone, date_of_birth, residence_address } = req.body || {};

  // Валидация обязательных полей анкеты
  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ error: 'Укажите полное ФИО' });
  }
  if (!date_of_birth) {
    return res.status(400).json({ error: 'Укажите дату рождения' });
  }
  // Проверка корректности даты рождения (не в будущем, возраст 14..100 лет)
  const dob = new Date(date_of_birth);
  if (isNaN(dob.getTime())) {
    return res.status(400).json({ error: 'Некорректная дата рождения' });
  }
  const now = new Date();
  const age = (now - dob) / (365.25 * 24 * 3600 * 1000);
  if (dob > now || age < 14 || age > 100) {
    return res.status(400).json({ error: 'Проверьте дату рождения' });
  }
  if (!residence_address || !String(residence_address).trim()) {
    return res.status(400).json({ error: 'Укажите адрес проживания' });
  }

  try {
    // Сотрудник должен существовать
    const emp = await pool.query('SELECT id FROM employees WHERE user_id = $1', [userId]);
    if (emp.rowCount === 0) {
      return res.status(404).json({ error: 'Вы не являетесь сотрудником' });
    }

    const result = await pool.query(
      `UPDATE employees
         SET full_name = $2,
             contact_phone = $3,
             phone = COALESCE($3, phone),
             date_of_birth = $4,
             residence_address = $5,
             profile_completed = true,
             is_active = true,
             activated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING id, full_name, is_active, profile_completed`,
      [userId, String(full_name).trim(), contact_phone ? String(contact_phone).trim() : null, date_of_birth, String(residence_address).trim()]
    );

    // Телефон полезно продублировать в профиль, если его там нет
    if (contact_phone) {
      try {
        await pool.query(
          `UPDATE profiles SET phone = COALESCE(NULLIF(phone, ''), $2) WHERE id = $1`,
          [userId, String(contact_phone).trim()]
        );
      } catch (_) { /* профиль мог отсутствовать — не критично */ }
    }

    console.log(`[Бэкенд: Анкета] Сотрудник ${userId} заполнил анкету и активирован`);
    res.json({ success: true, employee: result.rows[0] });
  } catch (err) {
    console.error('[Бэкенд: Анкета] Ошибка сохранения анкеты сотрудника:', err.message);
    res.status(500).json({ error: 'Ошибка сохранения анкеты: ' + err.message });
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
    const origin = req.headers.origin || 'https://xn--80aha5afebav9a.xn--p1ai';
    const redirectUrl = return_url || `${origin}/cabinet?check_payment=1&account=${encodeURIComponent(account_number || '')}&amount=${formattedAmount}`;

    const desc = (description || (account_number 
      ? `Оплата ТО домофона по л/с ${account_number}` 
      : 'Оплата услуг компании Домофондар')).substring(0, 128);

    // 1. Определение контактных данных плательщика для фискального чека (54-ФЗ)
    let customerPhone = req.body.customer_phone || req.body.customerPhone || req.body.phone || null;
    let customerEmail = req.body.customer_email || req.body.customerEmail || req.body.email || null;

    // Если контакты не переданы явно в теле запроса, но есть user_id — подтягиваем из профиля пользователя
    if ((!customerPhone || !customerEmail) && user_id) {
      try {
        const uRes = await pool.query(
          `SELECT u.email as user_email, p.phone as profile_phone, p.email as profile_email 
           FROM users u 
           LEFT JOIN profiles p ON p.id = u.id 
           WHERE u.id = $1 LIMIT 1`,
          [user_id]
        );
        if (uRes.rows.length > 0) {
          const row = uRes.rows[0];
          if (!customerPhone && row.profile_phone) customerPhone = row.profile_phone;
          if (!customerEmail && row.profile_email) customerEmail = row.profile_email;
          if (!customerEmail && row.user_email && row.user_email.includes('@')) customerEmail = row.user_email;
          // Если логин сохранен как номер телефона
          if (!customerPhone && row.user_email && !row.user_email.includes('@')) customerPhone = row.user_email;
        }
      } catch (profileErr) {
        console.warn('[Бэкенд: ЮKassa Чек] Предупреждение поиска профиля для чека:', profileErr.message);
      }
    }

    // Очистка и нормализация номера телефона (формат 7XXXXXXXXXX, 11 цифр)
    let cleanPhone = null;
    if (customerPhone) {
      const digits = String(customerPhone).replace(/\D/g, '');
      if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        cleanPhone = '7' + digits.substring(1);
      } else if (digits.length === 10) {
        cleanPhone = '7' + digits;
      }
    }

    // Проверка и нормализация email
    let cleanEmail = null;
    if (customerEmail && typeof customerEmail === 'string' && customerEmail.includes('@') && customerEmail.includes('.')) {
      cleanEmail = customerEmail.trim().toLowerCase();
    }

    // Формируем объект customer (ЮKassa требует обязательного наличия phone или email)
    const customerObj = {};
    if (cleanPhone) {
      customerObj.phone = cleanPhone;
    }
    if (cleanEmail) {
      customerObj.email = cleanEmail;
    }
    // Защитный резерв абонентской службы ООО «ДомофонДар»
    if (!customerObj.phone && !customerObj.email) {
      customerObj.phone = '79034118393';
      customerObj.email = 'domofondar@mail.ru';
    }

    // Наименование предмета расчета в чеке (до 128 символов)
    const itemTitle = (is_order 
      ? `Оплата оборудования/услуг (${account_number ? 'л/с ' + account_number : 'заказ'})`
      : `ТО домофона (${account_number ? 'л/с ' + account_number : 'услуга'})`
    ).substring(0, 128);

    // Фискальный чек в соответствии с 54-ФЗ (обязателен для боевого магазина ЮKassa)
    const receiptObj = {
      customer: customerObj,
      items: [
        {
          description: itemTitle,
          quantity: '1.00',
          amount: {
            value: formattedAmount,
            currency: 'RUB',
          },
          vat_code: 1, // 1 — без НДС (для плательщиков УСН)
          payment_mode: 'full_payment', // Полный расчет
          payment_subject: is_order ? 'commodity' : 'service', // Товар или услуга
        }
      ]
    };

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
      receipt: receiptObj,
      metadata: yooMetadata,
    };

    console.log(`[Бэкенд: ЮKassa] Запрос создания платежа на ${formattedAmount} ₽ (заказ: ${is_order ? 'ДА' : 'НЕТ'}, чек для: ${customerObj.phone || customerObj.email})...`);

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

// ------------------------------------------------------------------------------
// МОДУЛЬ ЗАГРУЗКИ ФАЙЛОВ (замена Supabase Storage после переезда на PostgreSQL)
// POST /api/upload  { fileBase64, fileName, fileType, folder } -> { url }
// ------------------------------------------------------------------------------
const ALLOWED_UPLOAD_FOLDERS = ['news', 'promotions', 'tasks', 'requests', 'calculations', 'portfolio', 'misc'];
const MEDIA_ROOT = path.join(__dirname, '../public/media');

app.post('/api/upload', async (req, res) => {
  try {
    const { fileBase64, fileName, fileType } = req.body;
    let { folder } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Файл или имя файла не переданы' });
    }
    if (!ALLOWED_UPLOAD_FOLDERS.includes(folder)) folder = 'misc';

    // Извлекаем чистый base64
    const matches = String(fileBase64).match(/^data:([A-Za-z0-9-+\/.]+);base64,(.+)$/);
    const buffer = matches && matches.length === 3
      ? Buffer.from(matches[2], 'base64')
      : Buffer.from(String(fileBase64), 'base64');

    // Ограничение размера — 25 МБ
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Файл слишком большой (максимум 25 МБ)' });
    }

    // Разрешаем только изображения, видео и документы
    const ext = (path.extname(fileName).toLowerCase() || '.bin');
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp4', '.mov', '.webm', '.pdf', '.doc', '.docx'];
    if (!allowedExt.includes(ext)) {
      return res.status(415).json({ error: `Недопустимый тип файла: ${ext}` });
    }

    const safeBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_').slice(0, 40);
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBase}${ext}`;

    const targetDir = path.join(MEDIA_ROOT, folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, uniqueName), buffer);

    const url = `/media/${folder}/${uniqueName}`;
    console.log(`[Бэкенд: Upload] Файл сохранён: ${url} (${(buffer.length / 1024).toFixed(0)} КБ)`);
    res.json({ success: true, url });
  } catch (err) {
    console.error('[Бэкенд: Upload] Ошибка загрузки файла:', err.message);
    res.status(500).json({ error: 'Ошибка сохранения файла на сервере' });
  }
});

// ------------------------------------------------------------------------------
// МОДУЛЬ ГОЛОСОВАНИЙ ЖИТЕЛЕЙ (замена Supabase Edge Function voting-submit)
// ------------------------------------------------------------------------------

// Шаг 1: запрос кода подтверждения по телефону
app.post('/api/voting/request-code', async (req, res) => {
  try {
    const { voting_id, phone } = req.body;
    if (!voting_id || !phone) return res.status(400).json({ error: 'voting_id и phone обязательны' });

    const normalized = String(phone).replace(/[^\d+]/g, '');
    if (normalized.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Некорректный номер' });

    const vRes = await pool.query('SELECT status, ends_at FROM votings WHERE id = $1 LIMIT 1', [voting_id]);
    const voting = vRes.rows[0];
    if (!voting || voting.status !== 'active') return res.status(400).json({ error: 'Голосование не активно' });
    if (voting.ends_at && new Date(voting.ends_at) < new Date()) return res.status(400).json({ error: 'Голосование завершено' });

    // Анти-спам: не чаще 1 кода в минуту
    const recentRes = await pool.query(
      'SELECT created_at FROM voting_phone_codes WHERE voting_id = $1 AND phone = $2 ORDER BY created_at DESC LIMIT 1',
      [voting_id, normalized]
    );
    const recent = recentRes.rows[0];
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 60000) {
      return res.status(429).json({ error: 'Подождите минуту перед повторной отправкой' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await pool.query(
      'INSERT INTO voting_phone_codes (voting_id, phone, code, expires_at) VALUES ($1, $2, $3, $4)',
      [voting_id, normalized, code, expires_at]
    );

    // TODO: подключить реальный SMS-провайдер (SMS.RU / Twilio). Пока код возвращается как dev_code.
    console.log(`[Бэкенд: Голосование] Код для ${normalized}: ${code}`);
    const smsConfigured = !!process.env.SMSRU_API_KEY;
    res.json({ ok: true, ...(smsConfigured ? {} : { dev_code: code }) });
  } catch (err) {
    console.error('[Бэкенд: Голосование] Ошибка запроса кода:', err.message);
    res.status(500).json({ error: 'Ошибка отправки кода' });
  }
});

// Шаг 2: проверка кода и приём бюллетеня
app.post('/api/voting/submit', async (req, res) => {
  const client = await pool.connect();
  try {
    const { voting_id, phone, code, full_name, apartment, area_sqm, is_owner_confirmed, answers } = req.body;
    if (!voting_id || !phone || !code || !full_name || !apartment || !answers?.length) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }
    if (!is_owner_confirmed) return res.status(400).json({ error: 'Подтвердите статус собственника' });

    const normalized = String(phone).replace(/[^\d+]/g, '');

    const recRes = await client.query(
      `SELECT * FROM voting_phone_codes WHERE voting_id = $1 AND phone = $2 AND is_used = false
       ORDER BY created_at DESC LIMIT 1`,
      [voting_id, normalized]
    );
    const rec = recRes.rows[0];
    if (!rec) return res.status(400).json({ error: 'Запросите код заново' });
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'Код просрочен' });
    if ((rec.attempts || 0) >= 5) return res.status(429).json({ error: 'Превышено число попыток' });
    if (String(rec.code) !== String(code)) {
      await client.query('UPDATE voting_phone_codes SET attempts = COALESCE(attempts,0) + 1 WHERE id = $1', [rec.id]);
      return res.status(400).json({ error: 'Неверный код' });
    }

    const vRes = await client.query('SELECT status, ends_at FROM votings WHERE id = $1 LIMIT 1', [voting_id]);
    const voting = vRes.rows[0];
    if (!voting || voting.status !== 'active') return res.status(400).json({ error: 'Голосование не активно' });
    if (voting.ends_at && new Date(voting.ends_at) < new Date()) return res.status(400).json({ error: 'Голосование завершено' });

    const existRes = await client.query(
      `SELECT id, is_revoked FROM voting_ballots WHERE voting_id = $1 AND voter_phone = $2 AND voter_apartment = $3 LIMIT 1`,
      [voting_id, normalized, String(apartment)]
    );
    if (existRes.rows[0] && !existRes.rows[0].is_revoked) {
      return res.status(409).json({ error: 'Бюллетень от этой квартиры уже принят' });
    }

    await client.query('BEGIN');
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const ua = req.headers['user-agent'] || null;
    const ballotRes = await client.query(
      `INSERT INTO voting_ballots
        (voting_id, voter_full_name, voter_phone, voter_apartment, voter_area_sqm, is_owner_confirmed, phone_verified_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, $6, $7) RETURNING id`,
      [voting_id, String(full_name).trim(), normalized, String(apartment).trim(), area_sqm ? Number(area_sqm) : null, ip, ua]
    );
    const ballotId = ballotRes.rows[0].id;

    for (const a of answers) {
      await client.query(
        'INSERT INTO voting_answers (ballot_id, question_id, selected_option) VALUES ($1, $2, $3)',
        [ballotId, a.question_id, String(a.selected_option)]
      );
    }
    await client.query('UPDATE voting_phone_codes SET is_used = true WHERE id = $1', [rec.id]);
    await client.query('COMMIT');

    console.log(`[Бэкенд: Голосование] Принят бюллетень ${ballotId} (кв. ${apartment})`);
    res.json({ ok: true, ballot_id: ballotId });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('[Бэкенд: Голосование] Ошибка приёма бюллетеня:', err.message);
    res.status(500).json({ error: 'Ошибка сохранения бюллетеня' });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------------------
// МОДУЛЬ УВЕДОМЛЕНИЙ (замена Supabase Edge Functions notify + send-push)
// POST /api/notify { event, data } — web-push администраторам/адресатам.
// Работает при заданных VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY в .env; иначе просто логирует.
// ------------------------------------------------------------------------------
let webpush = null;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BKnzAAYc68ghFIetuQXHvo4e2qRUzBmbrQ1xUs_GQsahkrVZd3JX3rCfxUnTah0rRwwzu6xNN-ibL5KoH6UdkSg';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
try {
  webpush = require('web-push');
  if (VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails('mailto:domofondar@mail.ru', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[Бэкенд: Push] Web-Push настроен (VAPID ключи заданы)');
  } else {
    console.warn('[Бэкенд: Push] VAPID_PRIVATE_KEY не задан — push отключён (только лог)');
  }
} catch {
  console.warn('[Бэкенд: Push] Пакет web-push не установлен — push отключён');
}

function buildNotification(event, data = {}) {
  switch (event) {
    case 'request_created':
      return { roles: ['admin', 'director', 'dispatcher', 'manager'], title: '🔔 Новая заявка',
        body: `👤 ${data.name}\n📍 ${data.address}\n📞 ${data.phone}`, url: '/fsm' };
    case 'request_accepted':
      return { roles: ['admin', 'director', 'dispatcher'], title: '✅ Заявка принята',
        body: `👷 ${data.employee_name}\n👤 ${data.client_name}\n📍 ${data.address}`, url: '/fsm' };
    case 'request_completed':
      return { roles: ['admin', 'director', 'dispatcher'], title: '🎉 Заявка выполнена',
        body: `👷 ${data.employee_name}\n📍 ${data.address}`, url: '/fsm' };
    case 'request_cancelled':
      return { roles: ['admin', 'director', 'dispatcher'], title: '❌ Заявка отменена',
        body: `👤 ${data.client_name}\n📍 ${data.address}`, url: '/fsm' };
    case 'request_declined':
      return { roles: ['admin', 'director', 'dispatcher', 'master', 'engineer'], title: '🔄 Заявка возвращена',
        body: `👤 ${data.client_name}\n📍 ${data.address}`, url: '/fsm' };
    case 'task_assigned':
      return { user_ids: data.assigned_user_id ? [data.assigned_user_id] : [], title: '📋 Новая задача',
        body: `${data.title}\n📅 ${data.scheduled_date || 'Без даты'}`, url: '/fsm' };
    case 'verification_request':
      return { roles: ['admin', 'director'], title: '👤 Запрос на верификацию',
        body: `${data.full_name || 'Пользователь'} отправил данные на проверку`, url: '/fsm' };
    case 'verification_approved':
      return { user_ids: data.user_id ? [data.user_id] : [], title: '✅ Верификация одобрена',
        body: 'Ваш профиль успешно верифицирован!', url: '/cabinet' };
    default:
      return null;
  }
}

app.post('/api/notify', async (req, res) => {
  try {
    const { event, data } = req.body || {};
    const n = buildNotification(event, data || {});
    if (!n) return res.status(400).json({ error: 'Неизвестное событие уведомления' });

    console.log(`[Бэкенд: Уведомление] event=${event} -> ${n.title}`);

    // Если push не настроен — просто подтверждаем приём (заявки/верификация не должны падать)
    if (!webpush || !VAPID_PRIVATE_KEY) return res.json({ ok: true, delivered: 0, note: 'push_disabled' });

    // Определяем список user_id получателей
    let userIds = Array.isArray(n.user_ids) ? [...n.user_ids] : [];
    if (Array.isArray(n.roles) && n.roles.length > 0) {
      const roleRes = await pool.query('SELECT DISTINCT user_id FROM user_roles WHERE role = ANY($1)', [n.roles]);
      userIds.push(...roleRes.rows.map((r) => r.user_id));
    }
    userIds = [...new Set(userIds.filter(Boolean))];
    if (userIds.length === 0) return res.json({ ok: true, delivered: 0 });

    const subsRes = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)',
      [userIds]
    );

    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, data: { event, ...(data || {}) } });
    let delivered = 0;
    await Promise.all(subsRes.rows.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        delivered++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [s.endpoint]);
        }
      }
    }));

    res.json({ ok: true, delivered });
  } catch (err) {
    console.error('[Бэкенд: Уведомление] Ошибка:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------------------
// МОДУЛЬ ПОШАГОВОГО ПОИСКА АДРЕСА И ЛИЦЕВОГО СЧЁТА (для мастера заполнения ЛК)
// Работает по индексированным полям accounts (street/house/account_number/phone_clean),
// без тяжёлого ILIKE по всему адресу — не создаёт нагрузку на БД.
// ------------------------------------------------------------------------------

// Натуральная сортировка выражением (число, затем строка): «2 < 10 < 10а».
// Используется во ВНЕШНЕМ запросе над подзапросом с DISTINCT (иначе Postgres запрещает
// ORDER BY по выражению вместе с SELECT DISTINCT).
const natOrder = (col) => `ORDER BY NULLIF(regexp_replace(COALESCE(${col},''),'[^0-9]','','g'),'')::bigint NULLS LAST, ${col}`;

// Лёгкая проверка авторизации (валидность JWT, без обращения к БД) — для эндпоинтов поиска.
// Закрывает анонимный доступ к адресной базе абонентов.
const requireAuthLite = (req, res, next) => {
  const h = req.headers['authorization'];
  const token = h && h.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  jwt.verify(token, ACTIVE_JWT_SECRET, (err) => {
    if (err) return res.status(403).json({ error: 'Недействительный токен сессии' });
    next();
  });
};

// 1. Подсказки улиц
app.get('/api/lookup/streets', requireAuthLite, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) return res.json([]);
    const r = await pool.query(
      `SELECT DISTINCT street FROM accounts
       WHERE street IS NOT NULL AND street ILIKE '%' || $1 || '%'
       ORDER BY street LIMIT 20`,
      [q]
    );
    res.json(r.rows.map((x) => x.street));
  } catch (err) {
    console.error('[Бэкенд: Lookup улицы]', err.message);
    res.status(500).json({ error: 'Ошибка поиска улиц' });
  }
});

// 2. Дома на улице (с корпусом)
app.get('/api/lookup/houses', requireAuthLite, async (req, res) => {
  try {
    const street = String(req.query.street || '').trim();
    if (!street) return res.json([]);
    const r = await pool.query(
      `SELECT house, housing FROM (
         SELECT DISTINCT house, housing FROM accounts
         WHERE street = $1 AND house IS NOT NULL
       ) t ${natOrder('house')}, housing`,
      [street]
    );
    // Возвращаем красивую метку дома (дом + корпус) и составные части
    res.json(r.rows.map((x) => ({
      house: x.house,
      housing: x.housing || null,
      label: x.housing ? `${x.house} к${x.housing}` : x.house,
    })));
  } catch (err) {
    console.error('[Бэкенд: Lookup дома]', err.message);
    res.status(500).json({ error: 'Ошибка поиска домов' });
  }
});

// 3. Подъезды дома (плитки). Флаг умного домофона — из таблицы entrances.
app.get('/api/lookup/entrances', requireAuthLite, async (req, res) => {
  try {
    const street = String(req.query.street || '').trim();
    const house = String(req.query.house || '').trim();
    const housing = String(req.query.housing || '').trim();
    if (!street || !house) return res.json([]);
    const r = await pool.query(
      `SELECT entrance FROM (
         SELECT DISTINCT entrance FROM accounts
         WHERE street = $1 AND house = $2 AND COALESCE(housing,'') = $3 AND entrance IS NOT NULL
       ) t ${natOrder('entrance')}`,
      [street, house, housing]
    );
    // Подтягиваем флаги умного домофона по этому дому (в entrances корпус вшит в house)
    const houseVariants = [house, housing ? `${house} к${housing}` : house, housing ? `${house}к${housing}` : house];
    let smart = {};
    try {
      const e = await pool.query(
        `SELECT entrance, has_smart_intercom FROM entrances
         WHERE street ILIKE '%' || $1 || '%' AND house = ANY($2)`,
        [street.replace(/\s*\(ул\)\s*/i, '').trim(), houseVariants]
      );
      e.rows.forEach((row) => { smart[String(row.entrance)] = !!row.has_smart_intercom; });
    } catch (e2) { /* entrances может отсутствовать — не критично */ }
    res.json(r.rows.map((x) => ({
      entrance: x.entrance,
      has_smart_intercom: !!smart[String(x.entrance)],
    })));
  } catch (err) {
    console.error('[Бэкенд: Lookup подъезды]', err.message);
    res.status(500).json({ error: 'Ошибка поиска подъездов' });
  }
});

// 4. Квартиры в подъезде (плитки)
app.get('/api/lookup/apartments', requireAuthLite, async (req, res) => {
  try {
    const street = String(req.query.street || '').trim();
    const house = String(req.query.house || '').trim();
    const housing = String(req.query.housing || '').trim();
    const entrance = String(req.query.entrance || '').trim();
    if (!street || !house || !entrance) return res.json([]);
    const r = await pool.query(
      `SELECT apartment, account_number, address FROM (
         SELECT DISTINCT ON (apartment) apartment, account_number, address FROM accounts
         WHERE street = $1 AND house = $2 AND COALESCE(housing,'') = $3 AND entrance = $4 AND apartment IS NOT NULL
         ORDER BY apartment, period DESC
       ) t ${natOrder('apartment')}`,
      [street, house, housing, entrance]
    );
    // Возвращаем и полный адрес абонента (с реальным городом/районом) — визард сохранит именно его.
    res.json(r.rows.map((x) => ({ apartment: x.apartment, account_number: x.account_number, address: x.address })));
  } catch (err) {
    console.error('[Бэкенд: Lookup квартиры]', err.message);
    res.status(500).json({ error: 'Ошибка поиска квартир' });
  }
});

// 5. Поиск лицевого счёта по номеру (с квитанции) — нормализуем до 10 цифр
app.get('/api/lookup/account', requireAuthLite, async (req, res) => {
  try {
    const raw = String(req.query.number || '').replace(/\D/g, '');
    if (!raw) return res.json(null);
    const padded = raw.padStart(10, '0');
    // ТОЛЬКО точное совпадение (номер, дополненный нулями до 10 цифр, или как ввели).
    // Раньше был `ILIKE '%'||raw`, из-за чего «654» совпадало со ВСЕМИ счетами, оканчивающимися
    // на 654 (0000000654 … 0000009654), и бралось не то. Теперь — строго точный счёт.
    const r = await pool.query(
      `SELECT account_number, address, street, house, housing, entrance, apartment
       FROM accounts WHERE account_number = $1 OR account_number = $2
       ORDER BY (account_number = $1) DESC, period DESC
       LIMIT 1`,
      [padded, raw]
    );
    res.json(r.rows[0] || null);
  } catch (err) {
    console.error('[Бэкенд: Lookup счёт]', err.message);
    res.status(500).json({ error: 'Ошибка поиска лицевого счёта' });
  }
});

// 6. Поиск абонента по номеру телефона (последние 10 цифр) — поле phone_clean индексировано
app.get('/api/lookup/by-phone', requireAuthLite, async (req, res) => {
  try {
    const digits = String(req.query.phone || '').replace(/\D/g, '');
    if (digits.length < 10) return res.json(null);
    const last10 = digits.slice(-10);
    const r = await pool.query(
      `SELECT account_number, address, street, house, housing, entrance, apartment
       FROM accounts WHERE phone_clean LIKE '%' || $1 ORDER BY debt_amount DESC NULLS LAST LIMIT 1`,
      [last10]
    );
    res.json(r.rows[0] || null);
  } catch (err) {
    console.error('[Бэкенд: Lookup по телефону]', err.message);
    res.status(500).json({ error: 'Ошибка поиска по телефону' });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`[Бэкенд: Domofondar] Сервер успешно запущен на порту ${port}`);
  console.log(`[Бэкенд: Domofondar] Директория бэкапов: ${BACKUP_DIR}`);
  console.log(`[Бэкенд: Domofondar] Платежный шлюз ЮKassa: подключен (ShopId: ${YOOKASSA_SHOP_ID})`);
});

