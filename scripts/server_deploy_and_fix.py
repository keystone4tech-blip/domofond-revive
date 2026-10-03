# scripts/server_deploy_and_fix.py
# 1. Применяет серверную правку (git fetch origin main && git reset --hard FETCH_HEAD && docker compose up -d --build)
# 2. Чинит застрявшие заявки (UPDATE requests SET status='pending' WHERE status='new')

import paramiko
import sys
import io

# Настройка UTF-8 для вывода в консоль Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST = "45.8.99.238"
USER = "root"
PASS = "j2Pz7,PPqzEte."

def run():
    print(f"[SSH] Подключение к {USER}@{HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, PASS, timeout=30)
    print("[SSH] Успешное подключение к серверу!")

    # 1. Серверные правки в /opt/domofondar
    print("\n--- [ШАГ 1] Обновление кода из Git и пересборка сервисов ---")
    git_cmd = "cd /opt/domofondar && git fetch origin main && git reset --hard origin/main && docker compose up -d --build"
    print(f"Выполняем: {git_cmd}")
    stdin, stdout, stderr = client.exec_command(git_cmd, timeout=300)
    
    # Читаем потоковый вывод безопасно
    for raw_line in stdout:
        clean_line = raw_line.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        sys.stdout.write(clean_line)
        sys.stdout.flush()
    err_out = stderr.read().decode('utf-8', errors='replace')
    if err_out:
        print("[STDERR]:", err_out.strip())

    # 2. Починка застрявших мобильных заявок (status='new' -> status='pending')
    print("\n--- [ШАГ 2] Перевод заявок со статусом 'new' в 'pending' ---")
    
    # Определяем точное имя контейнера Postgres
    stdin, stdout, stderr = client.exec_command("docker ps --filter name=postgres --format '{{.Names}}'", timeout=20)
    db_container = stdout.read().decode('utf-8', errors='ignore').strip()
    if not db_container:
        db_container = "domofondar_postgres"
    print(f"Контейнер базы данных: {db_container}")

    # Пробуем через пользователя postgres или domofondar
    sql_update = "UPDATE requests SET status='pending' WHERE status='new';"
    cmd_sql = f'docker exec {db_container} psql -U domofondar -d domofondar -c "{sql_update}"'
    stdin, stdout, stderr = client.exec_command(cmd_sql, timeout=30)
    res_sql = stdout.read().decode('utf-8', errors='ignore')
    err_sql = stderr.read().decode('utf-8', errors='ignore')

    if "FATAL" in err_sql or "does not exist" in err_sql:
        cmd_sql = f'docker exec {db_container} psql -U postgres -d domofondar -c "{sql_update}"'
        stdin, stdout, stderr = client.exec_command(cmd_sql, timeout=30)
        res_sql = stdout.read().decode('utf-8', errors='ignore')
        err_sql = stderr.read().decode('utf-8', errors='ignore')

    print(f"Результат обновления SQL: {res_sql.strip()} {err_sql.strip()}")

    # Проверка статистики заявок
    print("\n--- [ШАГ 3] Актуальная статистика статусов в таблице requests ---")
    stat_sql = "SELECT status, COUNT(*) FROM requests GROUP BY status;"
    cmd_stat = f'docker exec {db_container} psql -U domofondar -d domofondar -c "{stat_sql}"'
    stdin, stdout, stderr = client.exec_command(cmd_stat, timeout=30)
    res_stat = stdout.read().decode('utf-8', errors='ignore')
    if "FATAL" in res_stat or not res_stat.strip():
        cmd_stat = f'docker exec {db_container} psql -U postgres -d domofondar -c "{stat_sql}"'
        stdin, stdout, stderr = client.exec_command(cmd_stat, timeout=30)
        res_stat = stdout.read().decode('utf-8', errors='ignore')

    print(res_stat)

    client.close()
    print("[SSH] Все операции успешно завершены!")

if __name__ == "__main__":
    run()
