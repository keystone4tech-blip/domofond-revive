import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

runs = [
    (38068839567, "Домофондар (Жильцы)"),
    (38068839555, "Офис Работа (Мастера)")
]

for rid, label in runs:
    cmd = "curl -s -H 'User-Agent: Mozilla/5.0' https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/runs/" + str(rid) + "/jobs"
    stdin, stdout, stderr = client.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace')
    try:
        data = json.loads(res)
        job = data['jobs'][0]
        print(f"\n=== {label} [Run {rid}] - Статус: {job['status']} ({job.get('conclusion')}) ===")
        for s in job.get('steps', []):
            if s['status'] == 'in_progress':
                print(f"  --> [СЕЙЧАС ВЫПОЛНЯЕТСЯ]: {s['name']}")
            elif s.get('conclusion') == 'success':
                print(f"  [+] {s['name']}")
            elif s.get('conclusion') == 'failure':
                print(f"  [X] ОШИБКА: {s['name']}")
    except Exception as e:
        print("Ошибка парсинга:", e)

client.close()
