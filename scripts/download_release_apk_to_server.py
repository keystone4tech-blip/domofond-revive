import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

print("Скачивание свежего APK v1.2.2 напрямую из GitHub Releases в /opt/domofondar/public/media/app/...")
cmd = """
cd /opt/domofondar/public/media/app && \
curl -L -s -o domofondar.apk "https://github.com/keystone4tech-blip/domofond-revive/releases/download/app-latest/domofondar.apk" && \
cp domofondar.apk domofondar-app.apk && \
ls -lh domofondar.apk
"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))

client.close()
