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

try:
    print("[3/4] Загрузка архива на сервер...")
    sftp = ssh.open_sftp()
    sftp.put(archive_path, "/var/www/domofondar/dist.tar.gz")
    sftp.close()

    # Распаковка и обновление контейнера
    print("[4/4] Распаковка dist и доставка в контейнер domofondar_frontend...")
    cmd = """
    cd /var/www/domofondar && \
    mkdir -p dist && \
    rm -rf dist/* && \
    tar -xzf dist.tar.gz -C dist/ && \
    rm -f dist.tar.gz && \
    docker cp dist/assets/. domofondar_frontend:/usr/share/nginx/html/assets/ && \
    docker cp dist/index.html domofondar_frontend:/usr/share/nginx/html/index.html && \
    docker cp dist/sw.js domofondar_frontend:/usr/share/nginx/html/sw.js && \
    docker cp dist/workbox-b51dd497.js domofondar_frontend:/usr/share/nginx/html/workbox-b51dd497.js && \
    docker cp dist/registerSW.js domofondar_frontend:/usr/share/nginx/html/registerSW.js && \
    docker cp dist/manifest.webmanifest domofondar_frontend:/usr/share/nginx/html/manifest.webmanifest && \
    docker exec domofondar_frontend chmod -R 755 /usr/share/nginx/html/assets && \
    docker exec domofondar_frontend nginx -s reload && \
    ls -la dist/
    """
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("STDOUT:", stdout.read().decode("utf-8"))
    err = stderr.read().decode("utf-8")
    if err:
        print("STDERR:", err)
finally:
    ssh.close()
    if os.path.exists(archive_path):
        try:
            os.remove(archive_path)
        except Exception as e:
            print("Ошибка при удалении локального архива:", e)

print("=== ДЕПЛОЙ ФРОНТЕНДА УСПЕШНО ЗАВЕРШЕН ===")
