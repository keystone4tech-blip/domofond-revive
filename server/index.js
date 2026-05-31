const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

// Middleware
app.use(cors());
app.use(express.json());

// DB Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL successfully!'))
  .catch(err => console.error('PostgreSQL connection error', err.stack));

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running and connected to DB!' });
});

// --- AUTH ROUTES ---

// Регистрация нового пользователя
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  
  // Проверяем обязательные поля на бэкенде
  if (!email || !password) {
    console.warn('[Бэкенд: Регистрация] Попытка регистрации с пустым email или паролем');
    return res.status(400).json({ error: 'Электронная почта и пароль обязательны для заполнения' });
  }

  // Приводим email к нижнему регистру и обрезаем пробелы для исключения дубликатов из-за регистра букв
  const cleanEmail = String(email).toLowerCase().trim();
  console.log(`[Бэкенд: Регистрация] Старт регистрации для Email: "${cleanEmail}"`);

  try {
    // 1. Проверяем, существует ли пользователь с таким email (без учета регистра букв)
    const userCheck = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (userCheck.rows.length > 0) {
      console.warn(`[Бэкенд: Регистрация] Отклонено: пользователь с Email "${cleanEmail}" уже существует`);
      return res.status(400).json({ error: 'Этот Email-адрес уже зарегистрирован. Пожалуйста, укажите другую почту или войдите в аккаунт.' });
    }

    // 2. Хэшируем пароль пользователя с солью 10 раундов
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Вставляем запись нового пользователя в таблицу users
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
      [cleanEmail, password_hash]
    );

    const user = newUser.rows[0];
    console.log(`[Бэкенд: Регистрация] Создана запись в users для ID: ${user.id}`);

    // 4. Создаем профиль пользователя (с поддержкой ON CONFLICT, так как триггер handle_new_user в СУБД может сработать быстрее)
    await pool.query(
      'INSERT INTO profiles (id, full_name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET full_name = $2',
      [user.id, full_name || '']
    );
    console.log(`[Бэкенд: Регистрация] Создан/обновлен профиль для ID: ${user.id}`);

    // 5. Генерируем JWT-токен сессии на 7 дней
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'authenticated', sub: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Бэкенд: Регистрация] Успешно завершена для Email: "${cleanEmail}"`);
    res.status(201).json({ user, token, session: { access_token: token, user } });
  } catch (err) {
    console.error('[Бэкенд: Регистрация] Критическая ошибка во время регистрации:', err);
    
    // Перехватываем ошибку PostgreSQL нарушение уникальности (код 23505) для email
    if (err.code === '23505') {
      console.warn(`[Бэкенд: Регистрация] Перехвачена ошибка СУБД unique_violation для Email: "${cleanEmail}"`);
      return res.status(400).json({ error: 'Этот Email-адрес уже зарегистрирован. Пожалуйста, укажите другую почту или войдите в личный кабинет.' });
    }
    
    res.status(500).json({ error: 'Критическая ошибка сервера при регистрации. Пожалуйста, повторите попытку позже.' });
  }
});

// Авторизация (вход) существующего пользователя
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Проверяем заполненность полей
  if (!email || !password) {
    console.warn('[Бэкенд: Вход] Попытка входа с пустым email или паролем');
    return res.status(400).json({ error: 'Электронная почта и пароль обязательны для заполнения' });
  }

  // Очищаем email
  const cleanEmail = String(email).toLowerCase().trim();
  console.log(`[Бэкенд: Вход] Попытка входа для Email: "${cleanEmail}"`);

  try {
    // 1. Ищем пользователя в таблице users по email (без учета регистра)
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (result.rows.length === 0) {
      console.warn(`[Бэкенд: Вход] Отклонено: пользователь "${cleanEmail}" не найден`);
      return res.status(401).json({ error: 'Неверный адрес электронной почты или пароль' });
    }

    const user = result.rows[0];

    // 2. Проверяем пароль (с поддержкой plain-text для старых миграций, с авто-обновлением до bcrypt хэша)
    let isMatch = false;
    if (password === user.password_hash) {
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

    // 3. Генерируем JWT-токен на 7 дней
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'authenticated', sub: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Бэкенд: Вход] Успешная авторизация для Email: "${cleanEmail}"`);
    res.json({ 
      user: { id: user.id, email: user.email, role: user.role }, 
      token, 
      session: { 
        access_token: token, 
        user: { id: user.id, email: user.email, role: user.role } 
      } 
    });
  } catch (err) {
    console.error('[Бэкенд: Вход] Критическая ошибка во время входа:', err);
    res.status(500).json({ error: 'Критическая ошибка сервера при авторизации. Пожалуйста, повторите попытку позже.' });
  }
});

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- CABINET ROUTES ---

// Получить профиль
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Обновить профиль
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { full_name, phone, address, apartment } = req.body;
  try {
    const result = await pool.query(
      'UPDATE profiles SET full_name = $1, phone = $2, address = $3, apartment = $4, is_verified = false, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [full_name, phone, address, apartment, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Получить счета
app.get('/api/accounts', authenticateToken, async (req, res) => {
  const { search } = req.query; // Search is used to filter by address/apartment
  try {
    // A simple implementation: return all, frontend will filter, or we can filter here
    const result = await pool.query('SELECT account_number, period, debt_amount, address, apartment FROM accounts ORDER BY period DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching accounts' });
  }
});

// Получить задачи (requests)
app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    // We return all requests, frontend will filter by phone/name for now as per current logic
    const result = await pool.query('SELECT * FROM requests ORDER BY created_at DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    // Return empty array if requests table doesn't exist yet
    res.json([]);
  }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
  const { name, phone, address, message, priority, status } = req.body;
  try {
    // Check if table exists, if not, create it on the fly for smooth migration
    await pool.query(`CREATE TABLE IF NOT EXISTS requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255),
      phone VARCHAR(50),
      address VARCHAR(255),
      message TEXT,
      priority VARCHAR(50),
      status VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`);

    const result = await pool.query(
      'INSERT INTO requests (name, phone, address, message, priority, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, phone, address, message, priority, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating request' });
  }
});

// Роли пользователя
app.get('/api/user/roles', authenticateToken, async (req, res) => {
  try {
    // Return mock roles or query real roles table
    res.json([{ role: req.user.role }]);
  } catch (err) {
    res.json([]);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
