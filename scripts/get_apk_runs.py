import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "curl -s -H 'User-Agent: Mozilla/5.0' 'https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/workflows/build-apk.yml/runs?per_page=5'"
stdin, stdout, stderr = client.exec_command(cmd)
res = stdout.read().decode('utf-8', errors='replace')

try:
    data = json.loads(res)
    for r in data.get('workflow_runs', []):
        print(f"ID: {r['id']}, Status: {r['status']}, Conclusion: {r['conclusion']}, Commit: {r['head_commit']['message'][:40]}")
except Exception as e:
    print("Error:", e, res[:300])

client.close()
