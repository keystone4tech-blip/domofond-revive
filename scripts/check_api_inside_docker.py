import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

stdin, stdout, stderr = client.exec_command("docker exec domofondar_backend curl -s http://127.0.0.1:5000/api/app/version")
print("Response inside docker:", stdout.read().decode('utf-8', errors='replace'))

client.close()
