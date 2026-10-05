import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

run_id = 37370609970
cmd = f"curl -s -H 'User-Agent: Mozilla/5.0' https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/runs/{run_id}"
stdin, stdout, stderr = client.exec_command(cmd)
res = stdout.read().decode('utf-8', errors='replace')
data = json.loads(res)
print("Run Status:", data.get('status'))
print("Run Conclusion:", data.get('conclusion'))
print("Run created_at:", data.get('created_at'))
print("Run updated_at:", data.get('updated_at'))

client.close()
