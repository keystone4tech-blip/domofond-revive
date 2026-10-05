# Push-уведомления: что нужно сделать вам (FCM / EAS)

Код push-уведомлений уже готов и в приложении, и на сервере. Чтобы уведомления **реально доставлялись на телефон при закрытом приложении**, нужно один раз настроить доставку. Ключи ввожу не я — их вводите вы в своей учётной записи (это требование безопасности).

## 1. Установить новые зависимости приложения
В папке `mobile`:
```bash
npm install
```
Добавлен пакет `expo-device` (нужен для получения push-токена).

## 2. Привязать projectId (EAS)
В папке `mobile` выполните:
```bash
npx eas init
```
Это создаст/привяжет `projectId` вашего проекта Expo. Приложение само его подхватит
(`Constants.expoConfig.extra.eas.projectId`). Без этого токен в production-сборке не получится.

## 3. Настроить FCM для Android (обязательно для Android)
Expo-облако отправляет push на Android через **Firebase Cloud Messaging (FCM)**.
1. Зайдите в [Firebase Console](https://console.firebase.google.com/) → создайте проект (или используйте существующий).
2. Добавьте Android-приложение с package name **`ru.domofondar.app`** (точно как в `app.config.ts`).
3. Скачайте `google-services.json`.
4. Положите файл в папку `mobile/` и укажите его в `app.config.ts` в секции `android`:
   ```ts
   android: {
     googleServicesFile: './google-services.json',
     // ...остальное без изменений
   }
   ```
5. В Firebase → Project settings → Cloud Messaging получите **FCM V1** доступ и загрузите его в учётку Expo:
   ```bash
   npx eas credentials
   ```
   Выберите Android → Push Notifications (FCM) → загрузите сервисный ключ (service account JSON из Firebase).

## 4. iOS (если будете собирать под iPhone)
При сборке через EAS выполните:
```bash
npx eas credentials
```
Выберите iOS → Push Notifications Key → создайте/загрузите APNs-ключ. EAS всё сделает сам.

## 5. Пересобрать приложение
Push-токены работают **только в собранном приложении** (не в Expo Go):
```bash
npm run build:apk     # тестовая сборка Android (APK)
# или
npm run build:aab     # релиз в Google Play
```

## 6. Проверка
1. Установите собранное приложение, войдите в кабинет — приложение запросит разрешение на уведомления и отправит токен на сервер (эндпоинт `/api/user/push-token`).
2. В БД появится запись в таблице `expo_push_tokens` (создаётся автоматически при старте сервера).
3. Создайте тестовую заявку из приложения — придёт push «✅ Заявка принята».

## Что уже делает сервер сам
- Создаёт таблицу `expo_push_tokens` при запуске.
- Шлёт push клиенту: при создании заявки, при успешной оплате, а также (best-effort) при смене статуса заявки / одобрении верификации через `/api/notify`.
- Сервер уже использует Node 20 (глобальный `fetch`) — дополнительных пакетов для отправки не требуется.

## Важно про статусы из CRM
Смена статуса заявки «принята/выполнена» в CRM идёт через отдельный сервис PostgREST, а не через `index.js`.
Чтобы клиент получал push на эти события, CRM должна вызывать `POST /api/notify` с событием
(`request_accepted` / `request_completed` / `request_cancelled`) и передавать `request_id` (или `client_user_id`)
в поле `data`. Тогда сервер сам найдёт владельца заявки и отправит ему push. Если нужно — помогу добавить этот вызов в CRM.
