import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "curl -k -s -o /dev/null -w '%{http_code}' https://127.0.0.1/crm && echo '' && curl -k -s -o /dev/null -w '%{http_code}' https://127.0.0.1/fsm"
stdin, stdout, stderr = client.exec_command(cmd)
res = stdout.read().decode('utf-8', errors='replace')
print("Curls from server localhost:", res.strip())

client.close()
