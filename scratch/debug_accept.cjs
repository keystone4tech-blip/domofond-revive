const POSTGREST_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:5000';

async function debugAccept() {
  console.log("1. Логинимся для получения токена...");
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
  });
  
  if (!loginRes.ok) {
    console.error("Ошибка логина:", await loginRes.text());
    return;
  }
  const { token, user } = await loginRes.json();
  console.log("Токен получен. Email:", user.email);

  console.log("\n2. Получаем одну заявку...");
  const reqRes = await fetch(`${POSTGREST_URL}/requests?limit=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!reqRes.ok) {
    console.error("Ошибка получения заявки:", await reqRes.text());
    return;
  }
  const requests = await reqRes.json();
  if (requests.length === 0) {
    console.log("Нет заявок для теста.");
    return;
  }
  const targetReq = requests[0];
  console.log("Целевая заявка:", targetReq.id, "Имя:", targetReq.name, "Текущий статус:", targetReq.status);

  console.log("\n3. Пытаемся обновить её статус (симулируем принятие в работу)...");
  const updateRes = await fetch(`${POSTGREST_URL}/requests?id=eq.${targetReq.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      status: 'in_progress',
      accepted_by: null, // или валидный UUID сотрудника
      accepted_at: new Date().toISOString(),
      notes: 'Тест принятия заявки через скрипт отладки'
    })
  });

  console.log("Статус ответа БД:", updateRes.status);
  const text = await updateRes.text();
  console.log("Тело ответа БД:", text);
}

debugAccept().catch(console.error);
