import os
import tarfile
import paramiko

# Создаем архив dist.tar.gz
print("[1/4] Создаем архив dist.tar.gz...")
archive_path = "dist.tar.gz"
with tarfile.open(archive_path, "w:gz") as tar:
    for root, dirs, files in os.walk("dist"):
        for file in files:
            full_path = os.path.join(root, file)
            # относительный путь внутри архива без префикса dist/
            arcname = os.path.relpath(full_path, "dist")
            tar.add(full_path, arcname=arcname)

file_size = os.path.getsize(archive_path)
print(f"Архив готов: {file_size / 1024 / 1024:.2f} МБ")

# Подключение по SSH и загрузка по SFTP
print("[2/4] Подключение к 45.8.99.238...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("45.8.99.238", 22, "root", "j2Pz7,PPqzEte.", timeout=30)

print("[3/4] Загрузка архива на сервер...")
sftp = ssh.open_sftp()
sftp.put(archive_path, "/var/www/domofondar/dist.tar.gz")
sftp.close()

# Распаковка и очистка
print("[4/4] Распаковка dist в /var/www/domofondar/dist...")
cmd = """
cd /var/www/domofondar && \
rm -rf dist/* && \
tar -xzf dist.tar.gz -C dist/ && \
rm dist.tar.gz && \
docker exec domofondar_frontend nginx -s reload && \
ls -la dist/
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:", stdout.read().decode("utf-8"))
err = stderr.read().decode("utf-8")
if err:
    print("STDERR:", err)

ssh.close()
os.remove(archive_path)
print("=== ДЕПЛОЙ ФРОНТЕНДА УСПЕШНО ЗАВЕРШЕН ===")
