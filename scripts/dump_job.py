import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

run_id = 37370609970
cmd = f"curl -s -H 'User-Agent: Mozilla/5.0' https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/runs/{run_id}/jobs"
stdin, stdout, stderr = client.exec_command(cmd)
res = stdout.read().decode('utf-8', errors='replace')
data = json.loads(res)
job = data['jobs'][0]
print(json.dumps(job, indent=2))

client.close()
