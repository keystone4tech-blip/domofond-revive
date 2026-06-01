# Конфигурация проекта ДомофонДар (Резервная копия)

> **⚠️ ВАЖНО: ЭТОТ ФАЙЛ НЕПРИКАСАЕМЫЙ.**
> Данный файл содержит эталонную конфигурацию, пароли, доступы и переменные окружения, необходимые для восстановления работы системы в случае непредвиденных сбоев.
> **ЗАПРЕЩЕНО** изменять данные в этом файле, если только не происходит официальная смена паролей или исправление критических конфигурационных ошибок на сервере.

---

## 🌐 1. Основные ссылки и доступы (Production)
*   **Публичный сайт (Frontend):** [https://domofondar.ru/](https://domofondar.ru/)
*   **Админ-панель:** [https://domofondar.ru/admin](https://domofondar.ru/admin)
*   **Кабинет / FSM (Сотрудники):** [https://domofondar.ru/cabinet](https://domofondar.ru/cabinet)

---

## 🖥️ 2. Доступы к VPS серверу
Все обновления кода заливаются автоматически через GitHub Actions, но при необходимости прямого доступа к серверу используются следующие данные:

*   **IP-адрес сервера:** `185.104.114.184`
*   **SSH Пользователь:** `root`
*   **Директория проекта на сервере:** `/opt/domofond_project`
*   *SSH пароль хранится в GitHub Secrets (`VPS_PASSWORD`). Доступ также настроен по SSH-ключам.*

---

## 🗄️ 3. Доступы к Базе Данных (PostgreSQL)
База данных запущена в Docker контейнере `domofond_postgres` на VPS сервере.

*   **Контейнер:** `domofond_postgres`
*   **Пользователь (User):** `postgres` (по умолчанию)
*   **Пароль (Password):** `postgres` (по умолчанию)
*   **База данных (Database):** `domofond` (по умолчанию)
*   **Порт внутри Docker сети:** `5432`

**Команда для прямого подключения к БД через SSH:**
```bash
docker exec -it domofond_postgres psql -U postgres -d domofond
```

---

## 👤 4. Учетные записи (Администратор)
В базе данных инициализирован базовый администраторский аккаунт. 
*(Примечание: Если вход по этому паролю не работает из-за хэширования, рекомендуется зарегистрировать новый аккаунт и назначить ему роль `admin` через базу данных).*

*   **Логин (Email):** `viruscorp4@gmail.com`
*   **Пароль:** `SuperNatural24!`
*   **Роль:** `admin` (Полный доступ к FSM, Аналитике и Управлению сотрудниками)

---

## ⚙️ 5. Эталонный .env файл (Переменные окружения)
Этот `.env` файл загружен на VPS сервер в папку `/opt/domofond_project/.env`. Именно он обеспечивает правильную связь фронтенда, бэкенда и PostgREST API через Nginx.

```env
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqYWV5Ynd1aG5va3JjcHJnYWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDgxMjMsImV4cCI6MjA3NTkyNDEyM30.4YFigdipt0v9bRYy-Q1NE4IPdDt_RoQbTzVGZALnnpg"
SUPABASE_URL="https://jjaeybwuhnokrcprgait.supabase.co"
VITE_SUPABASE_PROJECT_ID="jjaeybwuhnokrcprgait"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqYWV5Ynd1aG5va3JjcHJnYWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDgxMjMsImV4cCI6MjA3NTkyNDEyM30.4YFigdipt0v9bRYy-Q1NE4IPdDt_RoQbTzVGZALnnpg"
VITE_SUPABASE_URL="/api"
VITE_API_URL="/auth"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
```
*(Примечание: `VITE_SUPABASE_URL="/api"` и `VITE_API_URL="/auth"` используют относительные пути, чтобы Nginx reverse proxy мог безопасно перенаправлять запросы на контейнеры PostgREST и Backend внутри сети Docker без CORS и Mixed Content ошибок).*

---

## 🏗️ 6. Структура Контейнеров (Docker Compose)
При запуске `docker-compose up -d --build` поднимаются следующие контейнеры:
1.  **domofond_postgres** (База данных PostgreSQL 15, хранит все данные локально).
2.  **domofond_backend** (Специальный сервер аутентификации на Node.js `server/index.js`, обрабатывает логин/регистрацию по порту `5000`, проксируется Nginx через `/auth/`).
3.  **domofond_postgrest** (API сервер поверх базы данных, заменяет Supabase Data API. Проксируется Nginx через `/api/`).
4.  **domofond_frontend** (Контейнер `nginx:alpine`, который раздает скомпилированные Vite/React статические файлы).

---
*Документ создан в рамках перевода проекта на собственную архитектуру и VPS.*
