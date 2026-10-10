# -*- coding: utf-8 -*-
"""
Скрипт загрузки свежего скомпилированного office-work.apk из GitHub Releases
на боевой сервер в /opt/domofondar/public/media/app/
"""
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

print("Скачивание свежего office-work.apk из GitHub Releases на сервер...")
cmd = "cd /opt/domofondar/public/media/app && curl -L -s -o office-work.apk https://github.com/keystone4tech-blip/domofond-revive/releases/download/staff-app-latest/office-work.apk && ls -lh /opt/domofondar/public/media/app"

stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))

client.close()
print("Готово!")
