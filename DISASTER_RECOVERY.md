# Руководство по экстренному восстановлению системы (DISASTER RECOVERY)

Данный документ описывает пошаговый регламент развертывания проекта «Домофондар» с нуля на любом чистом сервере за **10 минут**, а также восстановление базы данных из резервной копии.

---

## 1. Требования к серверу (VPS)

- **ОС:** Ubuntu 22.04 LTS или Ubuntu 24.04 LTS (рекомендуется)
- **CPU / RAM:** от 2 vCPU, от 2 ГБ RAM (рекомендуется 4 ГБ)
- **Диск:** от 20 ГБ SSD/NVMe
- **Открытые порты:** 80 (HTTP), 443 (HTTPS), 22 (SSH)

---

## 2. Развертывание с нуля за 10 минут

### Шаг 1: Подключение к чистому серверу по SSH
```bash
ssh root@IP_ВАШЕГО_СЕРВЕРА
```

### Шаг 2: Установка Docker и Git (если не установлены)
```bash
apt update && apt upgrade -y
apt install -y git curl ufw
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
```

### Шаг 3: Клонирование репозитория
```bash
mkdir -p /opt
cd /opt
git clone https://github.com/keystone4tech-blip/domofond-revive.git domofondar
cd /opt/domofondar
```

### Шаг 4: Настройка файла окружения `.env`
Скопируйте шаблон и задайте реальные секреты:
```bash
cp .env.example .env
nano .env
```
*(Укажите надежный `POSTGRES_PASSWORD` и сгенерированный `JWT_SECRET`).*

### Шаг 5: Запуск всех сервисов
```bash
mkdir -p backups certbot/conf certbot/www
docker compose up -d --build
```

Проверьте статус контейнеров:
```bash
docker compose ps
```
Должно быть 4 работающих контейнера:
- `domofondar_postgres` (Up)
- `domofondar_backend` (Up)
- `domofondar_postgrest` (Up)
- `domofondar_frontend` (Up)

### Шаг 6: Настройка бесплатного SSL-сертификата Let's Encrypt
```bash
chmod +x scripts/setup_ssl.sh
bash scripts/setup_ssl.sh
```

### Шаг 7: Настройка ежедневных бэкапов в Cron (в 03:00 ночи)
```bash
crontab -e
```
Добавьте строку:
```cron
0 3 * * * /bin/bash /opt/domofondar/scripts/backup.sh >> /var/log/domofondar_backup.log 2>&1
```

---

## 3. Восстановление базы данных из резервной копии

Если вам необходимо восстановить данные абонентов и заявок из имеющегося архива `.sql.gz`:

### Вариант А: Восстановление через скрипт в одну команду
```bash
cd /opt/domofondar
bash scripts/restore.sh backups/domofondar_backup_ГГГГ-ММ-ДД_ЧЧ-мм-сс.sql.gz
```

### Вариант Б: Ручное восстановление дампа
```bash
# 1. Распаковываем и отправляем дамп прямо в PostgreSQL
gunzip -c backups/ИМЯ_ФАЙЛА.sql.gz | docker exec -i domofondar_postgres psql -U domofondar -d domofondar

# 2. Перезапускаем PostgREST для перечитывания схемы
docker compose restart postgrest
```

---

## 4. Экстренное создание резервной копии вручную

Создать снимок базы данных можно в любой момент без остановки сайта:
```bash
bash scripts/backup.sh
```
Файл сохранится в папку `/opt/domofondar/backups/` со сжатием Gzip.

Также создать и скачать бэкап можно прямо из браузера в панели управления сайтом (вкладка «💾 Бэкапы БД»).
