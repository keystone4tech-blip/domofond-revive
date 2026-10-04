# scripts/deploy_backend.py
# Быстрый и надежный деплой обновлений бэкенда на боевой сервер 45.8.99.238 через Paramiko SSH/SFTP

import paramiko
import os
import sys

HOST = "45.8.99.238"
USER = "root"
PASS = "j2Pz7,PPqzEte."
REMOTE_PATH = "/opt/domofondar/server/index.js"
LOCAL_PATH = os.path.join(os.path.dirname(__file__), "..", "server", "index.js")

def deploy():
    print(f"[Deploy] Подключение по SSH к {USER}@{HOST}:22...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(hostname=HOST, port=22, username=USER, password=PASS, timeout=15)
        print("[Deploy] Успешное SSH подключение!")

        # 1. Загрузка server/index.js через SFTP
        print(f"[Deploy] Загрузка {LOCAL_PATH} -> {REMOTE_PATH}...")
        sftp = client.open_sftp()
        sftp.put(LOCAL_PATH, REMOTE_PATH)
        sftp.close()
        print("[Deploy] Файл server/index.js успешно передан!")

        # 2. Копирование файла внутрь контейнера и перезапуск
        print("[Deploy] Копирование server/index.js внутрь контейнера domofondar_backend:/app/index.js...")
        cmd = "docker cp /opt/domofondar/server/index.js domofondar_backend:/app/index.js && docker restart domofondar_backend"
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        print(f"[Deploy] Результат: {out.strip()} {err.strip()}")

        # 3. Проверка актуальной версии приложения через внутренний curl
        print("[Deploy] Проверка ответа эндпоинта /api/app/version на сервере...")
        stdin, stdout, stderr = client.exec_command("sleep 3 && curl -s http://localhost:5000/api/app/version", timeout=15)
        res_version = stdout.read().decode('utf-8', errors='ignore')
        print(f"[Deploy] Ответ эндпоинта версии: {res_version}")

        print("[Deploy] Деплой успешно завершен!")
    except Exception as e:
        print(f"[Deploy ERROR] Ошибка деплоя: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    deploy()
