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

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
      [email, password_hash]
    );

    const user = newUser.rows[0];

    // Insert profile (ON CONFLICT — триггер handle_new_user() может создать профиль раньше)
    await pool.query(
      'INSERT INTO profiles (id, full_name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET full_name = $2',
      [user.id, full_name || '']
    );

    // Generate Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'authenticated', sub: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token, session: { access_token: token, user } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Авторизация
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    // NOTE: For the test admin (admin123), we inserted plain text directly into DB.
    // So we'll check plain text first, and if it fails, check bcrypt. (Only for migration purposes!)
    let isMatch = false;
    if (password === user.password_hash) {
      isMatch = true;
      // Auto upgrade password to hash for future logins
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password, salt);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    } else {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'authenticated', sub: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Provide response that somewhat mimics Supabase so frontend migration is easier
    res.json({ user: { id: user.id, email: user.email, role: user.role }, token, session: { access_token: token, user: { id: user.id, email: user.email, role: user.role } } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
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
