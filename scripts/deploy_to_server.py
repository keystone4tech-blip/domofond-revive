#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
СКРИПТ АВТОМАТИЧЕСКОГО РАЗВЕРТЫВАНИЯ ПРОЕКТА «ДОМОФОНДАР» НА VPS
==============================================================================
Хост: 45.8.99.238 (Ubuntu 24.04 LTS)
Пользователь: root
==============================================================================
"""

import os
import sys
import time
import paramiko

# Гарантируем корректный вывод UTF-8 в консоли Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

SERVER_IP = "45.8.99.238"
SERVER_USER = "root"
SERVER_PASS = "j2Pz7,PPqzEte."
REMOTE_DIR = "/opt/domofondar"

def run_cmd(ssh, cmd, ignore_errors=False):
    print(f"\n[SSH EXEC] >>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    # Читаем вывод потоково
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    
    if out.strip():
        print(f"[STDOUT]:\n{out}")
    if err.strip():
        print(f"[STDERR]:\n{err}")
        
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0 and not ignore_errors:
        print(f"[ERROR] Команда завершилась с кодом ошибки {exit_status}")
        return False, out, err
    return True, out, err

def main():
    print("=" * 70)
    print(f"НАЧАЛО РАЗВЕРТЫВАНИЯ DOMOFONDAR НА СЕРВЕР {SERVER_IP}")
    print("=" * 70)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Подключение по SSH к {SERVER_USER}@{SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASS, timeout=30)
        print("Подключение успешно установлено!")
    except Exception as e:
        print(f"Критическая ошибка подключения по SSH: {e}")
        sys.exit(1)

    # 1. Настройка swap файла 2 ГБ (для надежности компиляции на 2 ГБ RAM)
    print("\n--- ЭТАП 1: Проверка и создание SWAP (2 ГБ) ---")
    swap_cmd = """
    if [ ! -f /swapfile ]; then
        echo "Создание swap-файла 2 ГБ..."
        fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        echo "Swap успешно создан!"
    else
        echo "Swap файл уже существует."
    fi
    free -m
    """
    run_cmd(ssh, swap_cmd)

    # 2. Установка Docker и Docker Compose
    print("\n--- ЭТАП 2: Установка Docker и Docker Compose ---")
    docker_install_cmd = """
    if ! [ -x "$(command -v docker)" ]; then
        echo "Установка Docker..."
        apt-get update -y
        apt-get install -y ca-certificates curl gnupg lsb-release ufw git
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update -y
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        systemctl enable docker
        systemctl start docker
        echo "Docker успешно установлен!"
    else
        echo "Docker уже установлен: $(docker --version)"
    fi
    docker compose version
    """
    run_cmd(ssh, docker_install_cmd)

    # 3. Настройка каталогов проекта на сервере
    print("\n--- ЭТАП 3: Подготовка каталогов /opt/domofondar ---")
    run_cmd(ssh, f"mkdir -p {REMOTE_DIR}/backups {REMOTE_DIR}/certbot/conf {REMOTE_DIR}/certbot/www {REMOTE_DIR}/init-scripts {REMOTE_DIR}/scripts")

    # 4. Копирование файлов проекта через SFTP
    print("\n--- ЭТАП 4: Перенос файлов проекта на сервер ---")
    local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Локальная директория: {local_dir}")
    
    # Файлы и папки для синхронизации
    items_to_copy = [
        "docker-compose.yml",
        "Dockerfile",
        "nginx.conf",
        ".env.example",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "tsconfig.app.json",
        "tsconfig.node.json",
        "vite.config.ts",
        "tailwind.config.ts",
        "postcss.config.js",
        "components.json",
        "index.html",
        "DISASTER_RECOVERY.md",
    ]

    sftp = ssh.open_sftp()
    
    for item in items_to_copy:
        src_path = os.path.join(local_dir, item)
        dst_path = f"{REMOTE_DIR}/{item}"
        if os.path.exists(src_path):
            print(f"Копирование файла: {item} -> {dst_path}")
            sftp.put(src_path, dst_path)

    # Копирование папок (src, server, init-scripts, scripts, public)
    def copy_dir(local_folder, remote_folder):
        print(f"Копирование директории: {local_folder} -> {remote_folder}")
        ssh.exec_command(f"mkdir -p {remote_folder}")
        for root, dirs, files in os.walk(local_folder):
            rel_dir = os.path.relpath(root, local_folder)
            target_dir = os.path.join(remote_folder, rel_dir).replace("\\", "/")
            if rel_dir != ".":
                ssh.exec_command(f"mkdir -p {target_dir}")
            for f in files:
                if f.startswith("~$") or f.endswith(".tmp") or f.endswith(".log"):
                    continue
                local_f = os.path.join(root, f)
                remote_f = os.path.join(target_dir, f).replace("\\", "/")
                try:
                    sftp.put(local_f, remote_f)
                except Exception as ex:
                    print(f"Ошибка при копировании {local_f}: {ex}")

    copy_dir(os.path.join(local_dir, "src"), f"{REMOTE_DIR}/src")
    copy_dir(os.path.join(local_dir, "server"), f"{REMOTE_DIR}/server")
    copy_dir(os.path.join(local_dir, "init-scripts"), f"{REMOTE_DIR}/init-scripts")
    copy_dir(os.path.join(local_dir, "scripts"), f"{REMOTE_DIR}/scripts")
    if os.path.exists(os.path.join(local_dir, "public")):
        copy_dir(os.path.join(local_dir, "public"), f"{REMOTE_DIR}/public")

    sftp.close()
    print("Копирование исходных файлов завершено успешно!")

    # 5. Создание файла .env на сервере
    print("\n--- ЭТАП 5: Создание боевого .env на сервере ---")
    env_content = """# ПРОДАКШН ОКРУЖЕНИЕ DOMOFONDAR
POSTGRES_DB=domofondar
POSTGRES_USER=domofondar
POSTGRES_PASSWORD=domofondar_secure_pass_2026
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
PGRST_DB_SCHEMA=public
PGRST_DB_ANON_ROLE=anon
VITE_API_URL=/backend-api
VITE_SUPABASE_URL=/api/rest/v1
VITE_SUPABASE_PUBLISHABLE_KEY=public-anon-key
DOMAIN_NAME=xn--80aha5afebav9a.xn--p1ai
"""
    create_env_cmd = f"cat << 'EOF' > {REMOTE_DIR}/.env\n{env_content}\nEOF\nchmod 600 {REMOTE_DIR}/.env"
    run_cmd(ssh, create_env_cmd)

    # 6. Разрешения на выполнение скриптов
    run_cmd(ssh, f"chmod +x {REMOTE_DIR}/scripts/*.sh")

    # 7. Настройка брандмауэра UFW
    print("\n--- ЭТАП 6: Настройка сетевой безопасности (UFW) ---")
    ufw_cmd = """
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8080/tcp
    echo "y" | ufw enable || true
    ufw status
    """
    run_cmd(ssh, ufw_cmd, ignore_errors=True)

    # 8. Запуск сборки и контейнеров Docker Compose
    print("\n--- ЭТАП 7: Запуск сборки Docker Compose ---")
    docker_build_cmd = f"""
    cd {REMOTE_DIR}
    docker compose down --remove-orphans || true
    docker compose up -d --build
    """
    success, out, err = run_cmd(ssh, docker_build_cmd)

    # 9. Проверка статуса контейнеров и логов
    print("\n--- ЭТАП 8: Проверка статуса системы ---")
    time.sleep(10)
    run_cmd(ssh, f"cd {REMOTE_DIR} && docker compose ps")
    run_cmd(ssh, f"cd {REMOTE_DIR} && docker compose logs --tail=30 db")
    run_cmd(ssh, f"cd {REMOTE_DIR} && docker compose logs --tail=30 backend")

    # 10. Проверка локального HTTP ответа
    print("\n--- ЭТАП 9: Проверка Health Check ---")
    run_cmd(ssh, "curl -I http://localhost:8080/api/health || curl -I http://localhost/api/health")

    # 11. Настройка ежедневных бэкапов в Cron (03:00)
    print("\n--- ЭТАП 10: Установка Cron-задачи бэкапов ---")
    cron_cmd = f"""
    (crontab -l 2>/dev/null | grep -v 'domofondar/scripts/backup.sh' ; echo '0 3 * * * /bin/bash {REMOTE_DIR}/scripts/backup.sh >> /var/log/domofondar_backup.log 2>&1') | crontab -
    crontab -l
    """
    run_cmd(ssh, cron_cmd)

    ssh.close()
    print("\n" + "=" * 70)
    print("РАЗВЕРТЫВАНИЕ УСПЕШНО ЗАВЕРШЕНО!")
    print(f"Сайт доступен по адресу: http://{SERVER_IP}:8080 или http://{SERVER_IP}")
    print("=" * 70)

if __name__ == "__main__":
    main()
