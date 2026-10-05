import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', 22, 'root', 'j2Pz7,PPqzEte.', timeout=15)

stdin, stdout, stderr = client.exec_command('ls -la /opt/domofondar/public/media/app/ 2>&1; find /opt/domofondar -name "*.apk" -ls 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))
client.close()
