# Автоплатёж (рекуррентные платежи) ЮKassa — справочник по подключению

_Собрано для проекта «ДомофонДар». Дата: 2026-10-07._
_Используется обоими агентами: бэкенд/ЮKassa — Antigravity (`server/`), UI — Claude (`mobile/`)._

## Суть механики (3 шага)

1. **Сохранение карты (привязка).** При первом платеже передаётся флаг `save_payment_method: true`.
   ЮKassa сохраняет способ оплаты и возвращает его идентификатор.
2. **Получение `payment_method_id`.** После успешной оплаты в объекте платежа приходит
   `payment_method.saved = true` и `payment_method.id` — это и есть токен карты. Его нужно сохранить
   в БД в привязке к пользователю/лицевому счёту (мы уже сохраняем в таблицу `autopay_subscriptions`).
3. **Автосписание.** Дальше сервер **без участия пользователя** создаёт платёж `POST /v3/payments`,
   передавая `payment_method_id`. Подтверждение от клиента не требуется.

---

## Предусловие (ОБЯЗАТЕЛЬНО, делает владелец магазина)

> **По умолчанию автоплатежи работают ТОЛЬКО в тестовом магазине.**
> Для боевого режима нужно написать своему менеджеру ЮKassa и попросить **активировать рекуррентные платежи**
> для боевого магазина (Shop ID). Без этого автосписание на проде не пройдёт.

Также по правилам ЮKassa нужно подготовить **оферту/согласие** с условиями подключения и отключения автоплатежа
(у нас в приложении уже есть текст согласия и кнопка отключения).

---

## Шаг 1. Сохранение карты

### Вариант A — при реальной оплате (используем мы)
В запрос `POST /v3/payments` на создание обычного платежа добавить флаг:
```json
{
  "amount": { "value": "500.00", "currency": "RUB" },
  "capture": true,
  "confirmation": { "type": "redirect", "return_url": "https://домофондар.рф/cabinet?check_payment=1" },
  "description": "Оплата ТО домофона, л/с 0001234567",
  "save_payment_method": true,
  "metadata": { "account_number": "0001234567", "user_id": "<uuid>" }
}
```
Клиент оплачивает как обычно, карта привязывается.

### Вариант B — привязка на нулевую/малую сумму (без реальной покупки)
ЮKassa поддерживает «привязку без оплаты» — платёж на небольшую сумму (в примере доки — `2.00 ₽`),
который сохраняет карту. Подходит, если нужно включить автоплатёж, когда долга нет.
(см. раздел доки «Привязка на нулевую сумму».)

> Мы сейчас используем **Вариант A** (чекбокс «Подключить автоплатёж» на экране «Платежи» добавляет
> `save_payment_method: true` к оплате). Вариант B — опционально на будущее.

---

## Шаг 2. Получение и сохранение `payment_method_id` (вебхук)

После успешной оплаты приходит `payment.succeeded`. В объекте платежа:
```json
{
  "status": "succeeded",
  "payment_method": {
    "type": "bank_card",
    "id": "2490ded8-000f-5000-9000-1b68e7b15f3f",   // ← payment_method_id (токен карты)
    "saved": true,                                    // ← карта сохранена
    "title": "Bank card *4477",
    "card": {
      "first6": "555555",
      "last4": "4477",
      "expiry_year": "2027",
      "expiry_month": "07",
      "card_type": "MasterCard"
    }
  }
}
```
Нужно: если `payment_method.saved === true` и есть `payment_method.id` — сохранить `id`, `card.last4`,
`card.card_type` в `autopay_subscriptions` (привязка к `account_number` + `user_id`, `is_active=true`, `consent_at`).
**У нас это уже реализовано** в `processSuccessfulPayment` (я поправил upsert без зависимости от UNIQUE-констрейнта).

---

## Шаг 3. Автосписание по сохранённой карте (ежемесячный cron — ОСТАЛОСЬ СДЕЛАТЬ)

Запрос **без участия пользователя**:

**Headers:**
- `Authorization: Basic base64(<Shop ID>:<Secret Key>)`
- `Idempotence-Key: <uuid>` (уникальный на каждую попытку)
- `Content-Type: application/json`

**Body `POST https://api.yookassa.ru/v3/payments`:**
```json
{
  "amount": { "value": "500.00", "currency": "RUB" },
  "capture": true,
  "payment_method_id": "2490ded8-000f-5000-9000-1b68e7b15f3f",
  "description": "Автосписание ТО домофона, л/с 0001234567",
  "metadata": { "account_number": "0001234567", "user_id": "<uuid>", "autopay": "true" }
}
```
- `confirmation` НЕ нужен — подтверждение от клиента не требуется.
- Ответ: `status` = `succeeded` (успех) / `pending` (в обработке) / `canceled` (отказ).
- При отказе приходит `cancellation_details` с `party` и `reason` (например, `permission_revoked` — пользователь
  отозвал разрешение; `card_expired`; `insufficient_funds` и т.д.). На `permission_revoked`/`card_expired` —
  пометить подписку неактивной и уведомить пользователя.

**Логика крона (предлагаемая):**
1. Раз в месяц (день — на усмотрение, напр. 5-е число) выбрать из `autopay_subscriptions` все `is_active=true`.
2. Для каждого проверить долг по счёту; если долг > 0 — списать сумму долга (или фикс ТО).
3. Сумма: та же логика, что в ручной оплате — к списанию `amount = база + 5%`, `credit_amount = база` в metadata
   (чтобы долг уменьшался на базу, а комиссия эквайринга шла сверху, как сейчас).
4. `Idempotence-Key` формировать детерминированно на период (напр. `autopay-<account>-<YYYY-MM>`), чтобы случайный
   повтор крона не списал дважды.
5. По ответу: `succeeded` → уменьшить долг; `canceled` с `permission_revoked`/`card_expired` → `is_active=false` + push/уведомление.

---

## Что уже готово в проекте

**Бэкенд (`server/index.js`):**
- Таблица `autopay_subscriptions (user_id, account_number, payment_method_id, card_first6, card_last4, card_type, card_expiry_year, card_expiry_month, is_active, ...)`.
- `POST /api/payments/yookassa/create` принимает `save_payment_method` и прокидывает флаг в ЮKassa.
- Вебхук успеха сохраняет токен карты (upsert UPDATE-иначе-INSERT — фикс Claude).
- `GET /api/user/autopay/status?account_number=…` → `{ enabled, card_last4, card_type }`.
- `POST /api/user/autopay/disable { account_number }`.

**Приложение (`mobile/app/(tabs)/payments/index.tsx`):**
- Чекбокс «Подключить автоплатёж — сохранить карту» (добавляет `save_payment_method: true` + `user_id` к оплате).
- Карточка статуса «Автоплатёж включён • карта •••• 1234» с переключателем «Отключить».
- Текст согласия на автосписание.

## Что ОСТАЛОСЬ сделать

| № | Задача | Зона | Статус |
|---|--------|------|--------|
| 1 | **Активировать рекурренты в БОЕВОМ магазине** (написать менеджеру ЮKassa) | Владелец (вы) | ⏳ |
| 2 | **Ежемесячный cron автосписания** (Шаг 3) | Antigravity (`server/`) | ⏳ |
| 3 | Оферта/согласие (юр. текст) — финально утвердить | Владелец (вы) | текст в UI есть |
| 4 | Тест полного цикла в тестовом магазине ЮKassa | Antigravity + Claude | ⏳ |

---

## Источники (документация ЮKassa)
- Автоплатежи — основы: https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/basics
- Оплата по сохранённому способу: https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/pay-with-saved
- Привязка на нулевую сумму: https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/save-payment-method/save-without-payment
- Автоплатежи (поддержка): https://yookassa.ru/docs/support/payments/extra/autopayment
