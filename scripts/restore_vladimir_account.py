import paramiko
import re

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

# Восстанавливаем лицевой счет для Владимира
cmd_restore = """
UPDATE profiles 
SET account_number = '0000000654'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
  AND account_number IS NULL;
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd_restore}"')
print("UPDATE RESULT:", stdout.read().decode('utf-8', errors='replace'))

# Проверяем обновленный профиль
stdin, stdout, stderr = c.exec_command("docker exec domofondar_postgres psql -U domofondar -d domofondar -c \"SELECT id, email, phone, account_number, address, apartment FROM profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';\"")
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
