import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', 22, 'root', 'j2Pz7,PPqzEte.', timeout=20)

stdin, stdout, stderr = c.exec_command('git -C /opt/domofondar log -n 1 --oneline')
print("Git commit on server:", stdout.read().decode('utf-8', errors='replace').strip())

stdin, stdout, stderr = c.exec_command('grep -n -A 10 "api/app/version" /opt/domofondar/server/index.js')
print("Grep from file on server:\n", stdout.read().decode('utf-8', errors='replace'))

stdin, stdout, stderr = c.exec_command('docker compose -f /opt/domofondar/docker-compose.yml ps')
print("Docker ps:\n", stdout.read().decode('utf-8', errors='replace'))

c.close()
