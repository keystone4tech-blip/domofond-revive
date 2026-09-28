## Дата: 2026-09-28 (Аудит проекта + устранение наследия Supabase: загрузка файлов, голосования, уведомления, роли CRM)

### Контекст:
Полный аудит проекта (сайт домофондар.рф, backend, CRM, мобильное приложение, БД). Подтверждено, что большинство неисправностей вызвано переездом с Supabase на собственный PostgreSQL + PostgREST: в коде остались обращения к несуществующим на VPS сервисам Supabase (Storage, Edge Functions, Realtime) и к отсутствующей таблице `crm_roles`. Отдельный файл аудита: `AUDIT_DOMOFONDAR_2026-09-28.md`.

### Критические находки безопасности (P0, требуют ручного исправления на сервере):
- **PostgREST отдаёт анонимно** таблицы `users` (с `password_hash`), `accounts` (≈12 684 л/с с ПДн), `profiles`, `user_roles`, `payments` — на проде не применены `REVOKE ... FROM anon`. Нарушение 152-ФЗ.
- `JWT_SECRET` на сервере = дефолт из открытого шаблона.
- Роль `authenticated` имеет `GRANT ALL` на все таблицы, RLS нет.
- Вебхук ЮKassa (`/api/payments/yookassa/webhook`) без проверки подлинности и идемпотентности.
- Секреты в открытом виде в `scripts/deploy_to_server.py` (root-пароль VPS) и `server/index.js` (боевой ключ ЮKassa) — не в `.gitignore`.

### Изменения (устранение наследия Supabase):

- **Backend (`server/index.js`)** — добавлены собственные эндпоинты взамен Supabase:
  * `POST /api/upload` — универсальная загрузка файлов (base64) в `public/media/<folder>/`, whitelist папок (news/promotions/tasks/requests/calculations/portfolio/misc), лимит 25 МБ, проверка расширений. Замена Supabase Storage.
  * `POST /api/voting/request-code` и `POST /api/voting/submit` — приём голосований жителей (порт Edge Function `voting-submit`, транзакционная запись бюллетеня + ответов, анти-спам, dev-код пока нет SMS-провайдера).
  * `POST /api/notify` — web-push уведомления (порт `notify`+`send-push`): резолв получателей по ролям через `user_roles`, отправка на `push_subscriptions` через пакет `web-push`. Работает при заданных `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` в `.env`; без ключей — не падает, только логирует. Удаляет протухшие подписки (404/410).
- **`server/package.json`** — добавлена зависимость `web-push@^3.6.7` (нужен `npm install` в контейнере backend).
- **Frontend:**
  * Новый `src/lib/upload.ts` — helper `uploadFile(file, folder)` → `/backend-api/api/upload`.
  * Новый `src/lib/notify.ts` — helper `notify(event, data)` (fire-and-forget) → `/backend-api/api/notify`.
  * Заменены все `supabase.storage` (5 мест): `NewsManager`, `PromotionsManager`, `TaskDetails`, `RequestDetails`, `Calculator`.
  * Заменены `functions.invoke("voting-submit")` (2 места) в `Golosovanie.tsx` на fetch к новым эндпоинтам.
  * Заменены `functions.invoke("notify")` (Cabinet ×2, RequestDetails ×1) на helper `notify()`.
- **БД:** новая миграция `migration_crm_roles.sql` — создаёт таблицу `crm_roles` (+ 5 системных ролей: director/manager/dispatcher/master/engineer с правами, триггер `updated_at`, GRANT для `authenticated`, REVOKE для `anon`). Восстанавливает работу раздела «Сотрудники и роли» и загрузку прав сотрудников.

### НЕ трогали (осознанно, отдельная задача):
- AI-чат (`ChatWidget` → `functions/v1/chat`), автоновости (`news-generate`), SEO-AI (`seo-analyze`/`seo-apply`) — требуют ключ AI-провайдера, вынесены отдельно.
- Realtime в `FSMDashboard` (`supabase.channel`) — оставлен; предложено заменить на polling.

### Проверка:
- `node --check server/index.js` — OK.
- `vite build` — успешно, 4207 модулей, без ошибок. Ошибок типов не добавлено (осталось 74 старых `as any` к PostgREST, на сборку не влияют).
- Боевой сайт проверен только на чтение (без изменений): подтверждён состав таблиц/колонок, наличие `entrances/entrance_products/intercom_credentials/payments/votings` и RPC `sync_entrances_from_accounts`; отсутствие `crm_roles` и RPC `purchase_intercom_access`.

### Осталось сделать (следующие шаги):
1. Развернуть: `git push` (Actions соберут фронт), выполнить `migration_crm_roles.sql` на сервере, `npm install` в контейнере backend (web-push), при желании сгенерировать VAPID-ключи для реальных push.
2. Закрыть P0-уязвимости из аудита (доступ anon, JWT_SECRET, права authenticated, вебхук ЮKassa, секреты).
3. Исправить `Cabinet.tsx` (ReferenceError: `setOnlinePayments`, `setDisplayHousing`, `cn`, `Check`) и хранить `account_number` в профиле — «не отображается лицевой счёт».
4. Мобильное приложение: `API_URL` → `https://домофондар.рф/backend-api`, пересборка APK.
5. RPC `purchase_intercom_access` (покупка доступа к домофону) — создать или заменить на эндпоинт.
6. Единый логотип (сейчас нет; сгенерированный содержит ошибочную надпись «DOMOFOND»).

### Структура:
- `/server/index.js` — эндпоинты upload / voting / notify
- `/server/package.json` — web-push
- `/src/lib/upload.ts`, `/src/lib/notify.ts` — новые helper'ы
- `/src/components/admin/NewsManager.tsx`, `/src/components/admin/PromotionsManager.tsx` — загрузка через свой бэкенд
- `/src/components/fsm/TaskDetails.tsx`, `/src/components/fsm/RequestDetails.tsx` — фото задач/заявок + уведомления
- `/src/pages/Calculator.tsx` — сохранение КП
- `/src/pages/Golosovanie.tsx` — голосования через свой бэкенд
- `/src/pages/Cabinet.tsx` — уведомления через свой бэкенд
- `/migration_crm_roles.sql` — таблица crm_roles

---
