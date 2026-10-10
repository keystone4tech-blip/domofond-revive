import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

run_id = 38068839555
cmd = f"curl -s -H 'User-Agent: Mozilla/5.0' https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/runs/{run_id}/jobs"
stdin, stdout, stderr = client.exec_command(cmd)
res = stdout.read().decode('utf-8', errors='replace')

try:
    data = json.loads(res)
    job_id = data['jobs'][0]['id']
    print("Job ID:", job_id)
    # Получаем лог
    log_cmd = f"curl -s -L -H 'User-Agent: Mozilla/5.0' https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/jobs/{job_id}/logs"
    stdin, stdout, stderr = client.exec_command(log_cmd)
    log_text = stdout.read().decode('utf-8', errors='replace')
    
    # Ищем строки с ошибкой в логе
    lines = log_text.splitlines()
    print(f"Всего строк в логе: {len(lines)}")
    error_lines = [l for l in lines if 'FAILURE' in l or 'error' in l.lower() or 'exception' in l.lower() or 'failed' in l.lower()]
    print("\n--- Хвост лога с ошибками ---")
    for l in lines[-40:]:
        print(l)
except Exception as e:
    print("Error:", e, res[:300])

client.close()
