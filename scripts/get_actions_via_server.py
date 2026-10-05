import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "curl -s -H 'User-Agent: Mozilla/5.0' https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/runs?per_page=5"
stdin, stdout, stderr = client.exec_command(cmd)
res = stdout.read().decode('utf-8', errors='replace')

import json
try:
    data = json.loads(res)
    for r in data.get('workflow_runs', []):
        print(f"ID: {r['id']}, Name: {r['name']}, Conclusion: {r['conclusion']}, Status: {r['status']}, URL: {r['html_url']}")
except Exception as e:
    print("Error parsing json:", e, res[:200])

client.close()
