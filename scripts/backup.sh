#!/bin/bash
# ==============================================================================
# СКРИПТ АВТОМАТИЧЕСКОГО РЕЗЕРВНОГО КОПИРОВАНИЯ БАЗЫ ДАННЫХ «DOMOFONDAR»
# ==============================================================================
# Запуск по Cron: 0 3 * * * /bin/bash /opt/domofondar/scripts/backup.sh
# ==============================================================================

set -e

# Директория проекта и бэкапов
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Создаем папку бэкапов, если не существует
mkdir -p "${BACKUP_DIR}"

# Формируем метку времени
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/domofondar_backup_${TIMESTAMP}.sql.gz"

echo "[$(date)] Начало создания резервной копии базы данных domofondar..."

# Загружаем переменные из .env, если файл существует
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-domofondar}"
DB_NAME="${POSTGRES_DB:-domofondar}"
CONTAINER_NAME="domofondar_postgres"

# Создаем дамп внутри контейнера и сжимаем gzip
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl | gzip > "${BACKUP_FILE}"

# Проверяем размер созданного файла
FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Резервная копия успешно создана: ${BACKUP_FILE} (Размер: ${FILE_SIZE})"

# Удаление старых резервных копий (старше 30 дней) для экономии диска
echo "[$(date)] Очистка резервных копий старше 30 дней..."
find "${BACKUP_DIR}" -name "domofondar_backup_*.sql.gz" -type f -mtime +30 -delete

echo "[$(date)] Процесс резервного копирования завершен успешно!"
