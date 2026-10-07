import paramiko
import sys

sql = sys.argv[1]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("45.8.99.238", 22, "root", "j2Pz7,PPqzEte.", timeout=30)

escaped_sql = sql.replace('"', '\\"')
cmd = f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{escaped_sql}"'
_, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:")
print(stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("STDERR:", err)
ssh.close()
