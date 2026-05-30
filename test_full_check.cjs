/**
 * Полная проверка доступности всех таблиц через PostgREST API
 * и тестирование ключевых операций CRUD.
 * 
 * Запуск: node test_full_check.cjs
 */

const POSTGREST_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:5000';

// Список всех 42 таблиц в базе данных
const ALL_TABLES = [
  'accounts', 'calculations', 'chat_conversations', 'chat_messages',
  'chat_widget_settings', 'clients', 'comments', 'contacts',
  'employees', 'likes', 'location_history', 'news',
  'news_automation_settings', 'news_drafts', 'news_segments', 'products',
  'profiles', 'promotions', 'push_subscriptions', 'request_checklists',
  'request_history', 'request_items', 'requests', 'seo_history',
  'seo_keywords', 'seo_page_meta', 'seo_settings', 'seo_suggestions',
  'site_blocks', 'task_checklists', 'task_photos', 'tasks',
  'telegram_conversations', 'telegram_messages_log', 'telegram_users',
  'user_roles', 'users', 'voting_answers', 'voting_ballots',
  'voting_phone_codes', 'voting_questions', 'votings'
];

// Цвета для вывода в консоль
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Шаг 1: Авторизация — получаем JWT токен
 */
async function login() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ШАГ 1: АВТОРИЗАЦИЯ (Backend → JWT)${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);

  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
  });

  if (!res.ok) {
    console.log(`${RED}✗ Логин не удался: ${res.status} ${await res.text()}${RESET}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`${GREEN}✓ Авторизация успешна!${RESET}`);
  console.log(`  Пользователь: ${data.user.email}`);
  console.log(`  ID: ${data.user.id}`);
  console.log(`  Роль: ${data.user.role}`);
  console.log(`  Токен: ${data.token.substring(0, 40)}...`);
  return { token: data.token, userId: data.user.id };
}

/**
 * Шаг 2: Проверка доступности всех таблиц через PostgREST (анонимный доступ)
 */
async function checkAllTablesAnon() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ШАГ 2: ДОСТУПНОСТЬ ТАБЛИЦ (Анонимный доступ)${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);

  let passed = 0;  // Количество успешных запросов
  let failed = 0;  // Количество неудачных запросов
  let rls = 0;     // Количество блокировок RLS (пустые результаты из-за политик)

  for (const table of ALL_TABLES) {
    try {
      const res = await fetch(`${POSTGREST_URL}/${table}?limit=1`);
      if (res.ok) {
        const data = await res.json();
        console.log(`${GREEN}✓${RESET} ${table.padEnd(28)} → ${res.status} OK (записей: ${data.length})`);
        passed++;
      } else {
        const body = await res.text();
        // 401 означает, что RLS требует авторизации — это нормально
        if (res.status === 401 || res.status === 403) {
          console.log(`${YELLOW}⚠${RESET} ${table.padEnd(28)} → ${res.status} RLS (требуется авторизация)`);
          rls++;
        } else {
          console.log(`${RED}✗${RESET} ${table.padEnd(28)} → ${res.status} ОШИБКА: ${body.substring(0, 80)}`);
          failed++;
        }
      }
    } catch (err) {
      console.log(`${RED}✗${RESET} ${table.padEnd(28)} → СБОЙ СОЕДИНЕНИЯ: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Итого: ${GREEN}${passed} доступно${RESET} | ${YELLOW}${rls} с RLS${RESET} | ${RED}${failed} ошибок${RESET}`);
  return { passed, failed, rls };
}

/**
 * Шаг 3: Проверка доступности таблиц с JWT-авторизацией
 */
async function checkAllTablesAuth(token) {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ШАГ 3: ДОСТУПНОСТЬ ТАБЛИЦ (С авторизацией JWT)${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);

  let passed = 0;
  let failed = 0;
  const failedTables = [];

  for (const table of ALL_TABLES) {
    try {
      const res = await fetch(`${POSTGREST_URL}/${table}?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`${GREEN}✓${RESET} ${table.padEnd(28)} → ${res.status} OK (записей: ${data.length})`);
        passed++;
      } else {
        const body = await res.text();
        console.log(`${RED}✗${RESET} ${table.padEnd(28)} → ${res.status} ОШИБКА: ${body.substring(0, 100)}`);
        failed++;
        failedTables.push({ table, status: res.status, error: body.substring(0, 100) });
      }
    } catch (err) {
      console.log(`${RED}✗${RESET} ${table.padEnd(28)} → СБОЙ: ${err.message}`);
      failed++;
      failedTables.push({ table, status: 0, error: err.message });
    }
  }

  console.log(`\n  Итого: ${GREEN}${passed} доступно${RESET} | ${RED}${failed} ошибок${RESET}`);
  return { passed, failed, failedTables };
}

/**
 * Шаг 4: Тестирование CRUD операций
 */
async function testCRUD(token, userId) {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ШАГ 4: ТЕСТИРОВАНИЕ CRUD ОПЕРАЦИЙ${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 4.1 — Чтение профиля администратора
  console.log(`\n  ${BOLD}4.1 Чтение профиля (profiles):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/profiles?id=eq.${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.length > 0) {
      console.log(`  ${GREEN}✓${RESET} Профиль найден: ${data[0].full_name} | ${data[0].phone}`);
    } else {
      console.log(`  ${YELLOW}⚠${RESET} Профиль пуст (RLS может блокировать)`);
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.2 — Запись: создание роли администратора
  console.log(`\n  ${BOLD}4.2 Запись роли (user_roles):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/user_roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, role: 'admin' })
    });
    if (res.ok || res.status === 201) {
      const data = await res.json();
      console.log(`  ${GREEN}✓${RESET} Роль 'admin' назначена пользователю ${userId}`);
    } else if (res.status === 409) {
      console.log(`  ${YELLOW}⚠${RESET} Роль уже существует (дубликат) — это нормально`);
    } else {
      const body = await res.text();
      console.log(`  ${RED}✗${RESET} Ошибка ${res.status}: ${body.substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.3 — Чтение ролей пользователя
  console.log(`\n  ${BOLD}4.3 Чтение ролей (user_roles):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/user_roles?user_id=eq.${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.length > 0) {
      console.log(`  ${GREEN}✓${RESET} Роли пользователя: ${data.map(r => r.role).join(', ')}`);
    } else {
      console.log(`  ${YELLOW}⚠${RESET} Роли не найдены (RLS может блокировать)`);
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.4 — Создание заявки (requests)
  console.log(`\n  ${BOLD}4.4 Создание заявки (requests):${RESET}`);
  let requestId = null;
  try {
    const res = await fetch(`${POSTGREST_URL}/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Тест Автоматический',
        phone: '+79990001122',
        address: 'ул. Тестовая, д.1',
        message: 'Автоматическая проверка создания заявки',
        status: 'pending',
        priority: 'medium'
      })
    });
    if (res.ok || res.status === 201) {
      const data = await res.json();
      requestId = data[0]?.id;
      console.log(`  ${GREEN}✓${RESET} Заявка создана: ID=${requestId}`);
    } else {
      const body = await res.text();
      console.log(`  ${RED}✗${RESET} Ошибка ${res.status}: ${body.substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.5 — Чтение новостей (публичная таблица)
  console.log(`\n  ${BOLD}4.5 Чтение новостей (news):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/news?is_published=eq.true&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`  ${GREEN}✓${RESET} Найдено опубликованных новостей: ${data.length}`);
    data.forEach(n => console.log(`    • ${n.title}`));
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.6 — Чтение лицевых счетов (accounts)
  console.log(`\n  ${BOLD}4.6 Чтение лицевых счетов (accounts):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/accounts?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`  ${GREEN}✓${RESET} Найдено счетов: ${data.length}`);
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.7 — Обновление профиля
  console.log(`\n  ${BOLD}4.7 Обновление профиля (profiles):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        full_name: 'Главный Администратор',
        phone: '+79991234567',
        address: 'ул. Центральная, д.1',
        apartment: '101'
      })
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`  ${GREEN}✓${RESET} Профиль обновлён: ${data[0]?.full_name}`);
    } else {
      const body = await res.text();
      console.log(`  ${RED}✗${RESET} Ошибка ${res.status}: ${body.substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  // 4.8 — Проверка расчётов (calculations)
  console.log(`\n  ${BOLD}4.8 Чтение расчётов (calculations):${RESET}`);
  try {
    const res = await fetch(`${POSTGREST_URL}/calculations?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`  ${GREEN}✓${RESET} Найдено расчётов: ${data.length}`);
  } catch (err) {
    console.log(`  ${RED}✗${RESET} Ошибка: ${err.message}`);
  }

  return requestId;
}

/**
 * Шаг 5: Проверка регистрации нового пользователя
 */
async function testRegistration() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ШАГ 5: РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `testuser_${Date.now()}@domofond.ru`,
        password: 'test12345',
        full_name: 'Тестовый Пользователь',
        phone: '+79998887766'
      })
    });

    if (res.ok || res.status === 201) {
      const data = await res.json();
      console.log(`${GREEN}✓${RESET} Регистрация успешна!`);
      console.log(`  Email: ${data.user?.email || 'N/A'}`);
      console.log(`  ID: ${data.user?.id || 'N/A'}`);
      return data;
    } else {
      const body = await res.text();
      console.log(`${RED}✗${RESET} Ошибка регистрации ${res.status}: ${body.substring(0, 150)}`);
    }
  } catch (err) {
    console.log(`${RED}✗${RESET} Ошибка соединения: ${err.message}`);
  }
  return null;
}

/**
 * Шаг 6: Проверка фронтенда
 */
async function testFrontend() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ШАГ 6: ПРОВЕРКА ФРОНТЕНДА${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);

  const pages = [
    { url: 'http://localhost:8080/', name: 'Главная' },
    { url: 'http://localhost:8080/auth', name: 'Авторизация' },
    { url: 'http://localhost:8080/calculator', name: 'Калькулятор' },
  ];

  for (const page of pages) {
    try {
      const res = await fetch(page.url);
      if (res.ok) {
        const text = await res.text();
        console.log(`${GREEN}✓${RESET} ${page.name.padEnd(20)} → ${res.status} OK (${(text.length / 1024).toFixed(1)} KB)`);
      } else {
        console.log(`${RED}✗${RESET} ${page.name.padEnd(20)} → ${res.status} ОШИБКА`);
      }
    } catch (err) {
      console.log(`${RED}✗${RESET} ${page.name.padEnd(20)} → НЕДОСТУПНА: ${err.message}`);
    }
  }
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ — запуск всех тестов
 */
async function main() {
  console.log(`${BOLD}${CYAN}`);
  console.log(`╔═══════════════════════════════════════════════════╗`);
  console.log(`║   ДОМОФОНД — ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ             ║`);
  console.log(`║   Backend + PostgREST + PostgreSQL + Frontend    ║`);
  console.log(`╚═══════════════════════════════════════════════════╝${RESET}`);
  console.log(`  Время: ${new Date().toLocaleString('ru-RU')}`);

  // 1. Авторизация
  const { token, userId } = await login();

  // 2. Анонимный доступ к таблицам
  const anonResult = await checkAllTablesAnon();

  // 3. Авторизованный доступ к таблицам
  const authResult = await checkAllTablesAuth(token);

  // 4. CRUD операции
  const requestId = await testCRUD(token, userId);

  // 5. Регистрация
  await testRegistration();

  // 6. Фронтенд
  await testFrontend();

  // ИТОГОВЫЙ ОТЧЁТ
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ИТОГОВЫЙ ОТЧЁТ${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`  Всего таблиц в БД:          ${ALL_TABLES.length}`);
  console.log(`  Анонимный доступ:            ${GREEN}${anonResult.passed}${RESET} OK | ${YELLOW}${anonResult.rls}${RESET} RLS | ${RED}${anonResult.failed}${RESET} ошибок`);
  console.log(`  Авторизованный доступ:       ${GREEN}${authResult.passed}${RESET} OK | ${RED}${authResult.failed}${RESET} ошибок`);

  if (authResult.failedTables.length > 0) {
    console.log(`\n  ${RED}Проблемные таблицы:${RESET}`);
    authResult.failedTables.forEach(t => {
      console.log(`    ${RED}✗${RESET} ${t.table}: ${t.error}`);
    });
  }

  console.log(`\n  ${BOLD}Завершено: ${new Date().toLocaleString('ru-RU')}${RESET}\n`);
}

main().catch(err => {
  console.error(`${RED}Критическая ошибка: ${err.message}${RESET}`);
  process.exit(1);
});
