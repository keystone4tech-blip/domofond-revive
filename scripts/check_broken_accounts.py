# scripts/check_broken_accounts.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sql = """
SELECT account_number, address, apartment, phone, full_name, debt_amount 
FROM accounts 
WHERE address ILIKE '%Куликова Поля%' AND (apartment = '128' OR address ILIKE '%128%');
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')
    cmd = 'docker exec -i domofondar_postgres psql -U domofondar -d domofondar -t'
    stdin, stdout, stderr = client.exec_command(cmd)
    stdin.write(sql)
    stdin.channel.shutdown_write()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    import json
    parsed = json.loads(out.strip())
    print("address:", parsed.get("address"))
    print("apartment:", parsed.get("apartment"))
    print("account_number:", parsed.get("account_number"))
    print("data_change_notification:", parsed.get("data_change_notification"))
finally:
    client.close()
