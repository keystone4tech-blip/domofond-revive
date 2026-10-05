import paramiko
import sys

# Настройка вывода для предотвращения проблем с кодировкой cp1251
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

stdin, stdout, stderr = client.exec_command('docker ps --filter name=frontend --format "{{.Names}}: {{.Status}}"')
out = stdout.read().decode('utf-8', errors='replace')
print("Status:", out.strip())

# Также проверим последний коммит на сервере
stdin, stdout, stderr = client.exec_command('cd /opt/domofondar && git log -1 --oneline')
git_log = stdout.read().decode('utf-8', errors='replace')
print("Server Git commit:", git_log.strip())

client.close()
