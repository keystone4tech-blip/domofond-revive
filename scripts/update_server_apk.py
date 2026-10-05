import paramiko
import sys

HOST = "45.8.99.238"
USER = "root"
PASS = "j2Pz7,PPqzEte."

def update_server_apk():
    print(f"[SSH] Подключение к {USER}@{HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, PASS, timeout=30)
    print("[SSH] Успешное подключение!")

    cmd = """
    cd /opt/domofondar/public/media/app && \
    curl -L -o domofondar.apk.new "https://github.com/keystone4tech-blip/domofond-revive/releases/download/app-latest/domofondar.apk" && \
    if [ -s domofondar.apk.new ]; then
        mv -f domofondar.apk.new domofondar.apk
        cp -f domofondar.apk domofondar-app.apk
        chmod 644 domofondar.apk domofondar-app.apk
        echo "[SUCCESS] APK успешно обновлен на сервере!"
        ls -la domofondar.apk
    else
        echo "[ERROR] Ошибка скачивания APK"
        rm -f domofondar.apk.new
        exit 1
    fi
    """

    print("[SSH] Скачивание свежего APK v1.2.0 на сервере...")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("[STDERR]:", err)

    client.close()

if __name__ == "__main__":
    update_server_apk()
