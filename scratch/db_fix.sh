#!/bin/bash
# Скрипт для принудительного восстановления доступа к PostgreSQL БД на VPS
# Вырезает все активные сессии бэкенда и сбрасывает пароль на 'postgres'.

echo "=== 1. Останавливаем зависимые контейнеры для сброса зависших сессий ==="
cd /opt/domofond_project
docker compose stop backend postgrest

echo "=== 2. Сбрасываем пароль пользователя postgres на 'postgres' ==="
# Запускаем psql от имени локального системного пользователя postgres внутри докера
docker exec -u postgres domofond_postgres psql -d domofond -c "ALTER USER postgres WITH PASSWORD 'postgres';"

echo "=== 3. Запускаем контейнеры обратно ==="
docker compose start backend postgrest

echo "=== 4. Проверяем статус контейнеров ==="
docker ps
