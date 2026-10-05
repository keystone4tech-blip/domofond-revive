import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "ls -la --time-style=full-iso /opt/domofondar/public/media/app/domofondar.apk"
stdin, stdout, stderr = client.exec_command(cmd)
print("Time style:", stdout.read().decode('utf-8', errors='replace'))

client.close()
