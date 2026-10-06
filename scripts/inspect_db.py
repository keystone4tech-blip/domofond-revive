import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "docker exec domofondar_postgres psql -U domofondar -d domofondar -c \"SELECT address, count(*) FROM accounts WHERE address ILIKE '%Поля%16%' GROUP BY address;\""
stdin, stdout, stderr = c.exec_command(cmd)
print("ACCOUNTS KULIKOVA POLYA 16:\n", stdout.read().decode('utf-8', errors='replace'))

cmd2 = "docker exec domofondar_postgres psql -U domofondar -d domofondar -c \"SELECT address, count(*) FROM profiles WHERE address IS NOT NULL GROUP BY address LIMIT 20;\""
stdin, stdout, stderr = c.exec_command(cmd2)
print("PROFILES ADDRESSES:\n", stdout.read().decode('utf-8', errors='replace'))

c.close()
