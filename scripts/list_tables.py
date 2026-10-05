import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', 22, 'root', 'j2Pz7,PPqzEte.', timeout=15)

cmd = 'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "\\dt" 2>&1'
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
client.close()
