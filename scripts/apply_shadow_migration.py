import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', 22, 'root', 'j2Pz7,PPqzEte.', timeout=15)

with open('supabase/migrations/20261005230000_create_shadow_roles.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Выполняем SQL через docker exec
sql_escaped = sql.replace('"', '\\"')
cmd = f'docker exec -i domofondar_postgres psql -U domofondar -d domofondar << \'EOF\'\n{sql}\nEOF'
stdin, stdout, stderr = client.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8', errors='replace'))
print("STDERR:", stderr.read().decode('utf-8', errors='replace'))
client.close()
