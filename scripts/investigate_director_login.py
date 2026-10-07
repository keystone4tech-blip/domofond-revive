import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

print("=== 1. ALL PROFILES IN JSON ===")
stdin, stdout, stderr = c.exec_command('docker exec domofondar_postgres psql -U domofondar -d domofondar -t -A -c "SELECT json_agg(t)::text FROM (SELECT id, full_name, phone, email, role, created_at FROM profiles WHERE email LIKE \'%domofondar%\' OR email LIKE \'%mail.ru%\' OR phone LIKE \'%666777%\' OR phone LIKE \'%918%\') t;"')
print("PROFILES JSON:", stdout.read().decode('utf-8', errors='replace'))

print("=== 2. ALL USERS IN JSON ===")
stdin, stdout, stderr = c.exec_command('docker exec domofondar_postgres psql -U domofondar -d domofondar -t -A -c "SELECT json_agg(t)::text FROM (SELECT id, email, phone, role, created_at FROM users WHERE email LIKE \'%domofondar%\' OR email LIKE \'%mail.ru%\' OR phone LIKE \'%666777%\' OR phone LIKE \'%918%\') t;"')
print("USERS JSON:", stdout.read().decode('utf-8', errors='replace'))

print("=== 3. TODAY'S REGISTERED PROFILES (2026-10-07) ===")
stdin, stdout, stderr = c.exec_command('docker exec domofondar_postgres psql -U domofondar -d domofondar -t -A -c "SELECT json_agg(t)::text FROM (SELECT id, full_name, phone, email, role, created_at FROM profiles WHERE created_at >= \'2026-10-07\'::date OR updated_at >= \'2026-10-07\'::date) t;"')
print("TODAYS PROFILES:", stdout.read().decode('utf-8', errors='replace'))

print("=== 4. TODAY'S USERS (2026-10-07) ===")
stdin, stdout, stderr = c.exec_command('docker exec domofondar_postgres psql -U domofondar -d domofondar -t -A -c "SELECT json_agg(t)::text FROM (SELECT id, email, phone, role, created_at, updated_at FROM users WHERE created_at >= \'2026-10-07\'::date OR updated_at >= \'2026-10-07\'::date) t;"')
print("TODAYS USERS:", stdout.read().decode('utf-8', errors='replace'))

c.close()
