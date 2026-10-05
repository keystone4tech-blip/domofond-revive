import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

print("Обновление сервера и перезапуск бэкенда для активации версии 1.2.2...")
cmd = "cd /opt/domofondar && git fetch origin main && git reset --hard origin/main && docker compose restart backend"
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))

# Проверяем ответ /api/app/version
stdin, stdout, stderr = client.exec_command("curl -s http://127.0.0.1:5000/api/app/version")
print("Response /api/app/version:", stdout.read().decode('utf-8', errors='replace'))

client.close()
