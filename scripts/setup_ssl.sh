#!/bin/bash
# ==============================================================================
# СКРИПТ ВЫПУСКА SSL-СЕРТИФИКАТА ДЛЯ ДОМЕНА ДОМОФОНДАР.РФ (Let's Encrypt)
# ==============================================================================
# Домен: домофондар.рф (Punycode: xn--80aha5afebav9a.xn--p1ai)
# ==============================================================================

set -e

DOMAIN="xn--80aha5afebav9a.xn--p1ai"
EMAIL="domofondar@mail.ru"

echo "=== Выпуск бесплатного SSL-сертификата Let's Encrypt для ${DOMAIN} ==="

# Создаем директории для Certbot
mkdir -p certbot/conf certbot/www

# Запуск Certbot в автономном режиме через веб-корень
docker run -it --rm --name certbot \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}"

echo "=== Сертификат успешно получен! ==="
echo "Перезагрузите Nginx: docker compose exec frontend nginx -s reload"
