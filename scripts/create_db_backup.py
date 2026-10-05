import paramiko
from datetime import datetime

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', 22, 'root', 'j2Pz7,PPqzEte.', timeout=15)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_file = f"/opt/domofondar/backups/db_backup_pre_crm_{timestamp}.sql"

cmd = f"""
mkdir -p /opt/domofondar/backups && \
docker exec domofondar_postgres pg_dump -U domofondar -d domofondar > {backup_file} && \
gzip -f {backup_file} && \
ls -lh {backup_file}.gz
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))
client.close()
