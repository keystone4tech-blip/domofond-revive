import paramiko

# Подключение по SSH
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("45.8.99.238", 22, "root", "j2Pz7,PPqzEte.", timeout=15)

nginx_conf = """server {
    listen 80;
    server_name xn--80aha5afebav9a.xn--p1ai www.xn--80aha5afebav9a.xn--p1ai;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name xn--80aha5afebav9a.xn--p1ai www.xn--80aha5afebav9a.xn--p1ai;

    ssl_certificate /etc/letsencrypt/live/xn--80aha5afebav9a.xn--p1ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn--80aha5afebav9a.xn--p1ai/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Всегда отдаем свежий index.html без браузерного кэширования
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        expires -1;
    }

    # Service Worker PWA не должен застревать в кэше
    location ~* \\.(sw\\.js|registerSW\\.js|manifest\\.webmanifest)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        expires -1;
    }

    # Статические ассеты с уникальными хэшами Vite
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend container
    location /api/ {
        proxy_pass http://domofondar_backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy /backend-api/ if needed
    location /backend-api/ {
        rewrite ^/backend-api/(.*)$ /api/$1 break;
        proxy_pass http://domofondar_backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Media / APK downloads
    location /media/ {
        alias /media/;
        autoindex on;
    }
}
"""

sftp = ssh.open_sftp()
with sftp.file("/var/www/domofondar/nginx.conf", "w") as f:
    f.write(nginx_conf)
sftp.close()

stdin, stdout, stderr = ssh.exec_command("docker exec domofondar_frontend nginx -t && docker exec domofondar_frontend nginx -s reload")
print("STDOUT:", stdout.read().decode("utf-8"))
print("STDERR:", stderr.read().decode("utf-8"))
ssh.close()
print("NGINX_UPDATED_SUCCESSFULLY")
