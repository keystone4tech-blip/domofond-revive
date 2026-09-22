#!/bin/bash
# ==============================================================================
# СКРИПТ АВАРИЙНОГО ВОССТАНОВЛЕНИЯ БАЗЫ ДАННЫХ «DOMOFONDAR»
# ==============================================================================
# Использование:
#   bash scripts/restore.sh backups/domofondar_backup_2026-09-22_03-00-00.sql.gz
# ==============================================================================

set -e

if [ -z "$1" ]; then
    echo "ОШИБКА: Не указан файл резервной копии для восстановления!"
    echo "Пример использования:"
    echo "  bash scripts/restore.sh backups/domofondar_backup_YYYY-MM-DD_HH-mm-ss.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ОШИБКА: Файл ${BACKUP_FILE} не найден!"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Загружаем переменные из .env
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-domofondar}"
DB_NAME="${POSTGRES_DB:-domofondar}"
CONTAINER_NAME="domofondar_postgres"

echo "===================================================================="
echo "ВНИМАНИЕ! Вы собираетесь восстановить базу данных ${DB_NAME} из архива:"
echo "  ${BACKUP_FILE}"
echo "Текущие данные будут перезаписаны данными из резервной копии!"
echo "===================================================================="
read -p "Вы уверены, что хотите продолжить? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Восстановление отменено пользователем."
    exit 0
fi

echo "[$(date)] Остановка зависимых сервисов (backend, postgrest)..."
docker compose stop backend postgrest

echo "[$(date)] Восстановление базы данных domofondar из ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"

echo "[$(date)] Запуск сервисов..."
docker compose start backend postgrest

echo "[$(date)] База данных domofondar успешно восстановлена!"
echo "Проверьте статус системы: curl -I http://localhost:8080/api/health"
