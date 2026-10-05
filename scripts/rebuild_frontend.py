import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', 22, 'root', 'j2Pz7,PPqzEte.', timeout=15)

cmd = """
cd /opt/domofondar && \
git fetch origin main && \
git reset --hard origin/main && \
docker compose build frontend && \
docker compose up -d frontend
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))
client.close()
