import paramiko
import sys

HOST = "45.8.99.238"
USER = "root"
PASS = "j2Pz7,PPqzEte."

def deploy():
    print(f"[SSH] Подключение к {USER}@{HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, PASS, timeout=30)
    print("[SSH] Успешное подключение!")

    cmd = """
    cd /opt/domofondar && \
    git fetch origin main && \
    git reset --hard origin/main && \
    docker compose up -d --build backend frontend && \
    docker compose ps
    """

    print("[SSH] Выполняем сборку и перезапуск сервисов backend и frontend...")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    
    for raw_line in stdout:
        clean_line = raw_line.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        sys.stdout.write(clean_line)
        sys.stdout.flush()
        
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("[STDERR]:", err)

    client.close()
    print("[SSH] Сервер успешно обновлен!")

if __name__ == "__main__":
    deploy()
