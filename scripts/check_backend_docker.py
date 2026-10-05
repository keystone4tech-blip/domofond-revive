import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

stdin, stdout, stderr = client.exec_command("docker ps --filter name=backend --format '{{.Names}}: {{.Ports}} {{.Status}}'")
print("Docker backend status:", stdout.read().decode('utf-8', errors='replace'))

stdin, stdout, stderr = client.exec_command("docker logs domofondar_backend --tail 15")
print("Docker backend logs:", stdout.read().decode('utf-8', errors='replace'))

client.close()
