#!/bin/bash
set -e

echo "=========================================="
echo "🔧 Настройка Coturn TURN/STUN на VPS"
echo "=========================================="

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "❌ Этот скрипт должен быть запущен от root или с правами sudo."
    exit 1
  fi
else
  SUDO=""
fi

# 1. Установка coturn
echo "📦 1. Установка пакета coturn..."
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq coturn ufw openssl

# 2. Подготовка каталогов
echo "📁 2. Создание необходимых каталогов..."
$SUDO mkdir -p /etc/coturn/certs
$SUDO mkdir -p /var/log/turnserver

# 3. Настройка SSL/TLS сертификатов
DOMAIN="rvxis.site"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  echo "🔒 3. Найдены существующие сертификаты Let's Encrypt для $DOMAIN"
  $SUDO cp "$CERT_DIR/fullchain.pem" /etc/coturn/certs/fullchain.pem
  $SUDO cp "$CERT_DIR/privkey.pem" /etc/coturn/certs/privkey.pem
else
  echo "⚠️ 3. Сертификаты Let's Encrypt не найдены в $CERT_DIR. Создаём самоподписанный сертификат для TURNS..."
  $SUDO openssl req -x509 -newkey rsa:2048 -keyout /etc/coturn/certs/privkey.pem -out /etc/coturn/certs/fullchain.pem -days 365 -nodes -subj "/CN=$DOMAIN"
fi

$SUDO chmod 644 /etc/coturn/certs/fullchain.pem
$SUDO chmod 600 /etc/coturn/certs/privkey.pem
$SUDO chown -R turnserver:turnserver /etc/coturn /var/log/turnserver || true

# 4. Создание конфигурации turnserver.conf
echo "⚙️ 4. Запись конфигурации /etc/turnserver.conf..."
$SUDO cat > /etc/turnserver.conf << 'EOF'
# Основные порты
listening-port=3478
tls-listening-port=5349
alt-listening-port=3479
alt-tls-listening-port=5350

# Диапазон портов для медиа-потоков WebRTC
min-port=49152
max-port=65535

# Аутентификация
fingerprint
lt-cred-mech
user=voicechat:VoiceChatSecret2026!
realm=rvxis.site
server-name=rvxis.site

# Сертификаты для TURNS (TLS)
cert=/etc/coturn/certs/fullchain.pem
pkey=/etc/coturn/certs/privkey.pem

# Безопасность
no-cli
no-loopback-peers
no-multicast-peers

# Логирование
log-file=/var/log/turnserver/turnserver.log
verbose
EOF

# 5. Активация автозапуска в /etc/default/coturn
echo "🚀 5. Активация демона coturn..."
if [ -f /etc/default/coturn ]; then
  $SUDO sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
  $SUDO sed -i 's/TURNSERVER_ENABLED=0/TURNSERVER_ENABLED=1/' /etc/default/coturn
fi

# 6. Открытие портов в firewall (если UFW активен)
if command -v ufw >/dev/null 2>&1; then
  echo "🛡️ 6. Настройка портов в UFW firewall..."
  $SUDO ufw allow 3478/tcp >/dev/null 2>&1 || true
  $SUDO ufw allow 3478/udp >/dev/null 2>&1 || true
  $SUDO ufw allow 5349/tcp >/dev/null 2>&1 || true
  $SUDO ufw allow 5349/udp >/dev/null 2>&1 || true
  $SUDO ufw allow 49152:65535/udp >/dev/null 2>&1 || true
fi

# 7. Перезапуск службы
echo "🔄 7. Перезапуск службы coturn..."
$SUDO systemctl daemon-reload || true
$SUDO systemctl restart coturn
$SUDO systemctl enable coturn

echo "=========================================="
echo "✅ Coturn успешно установлен и запущен!"
echo "📡 STUN: stun:rvxis.site:3478"
echo "🔄 TURN: turn:rvxis.site:3478 (UDP & TCP)"
echo "🔒 TURNS: turns:rvxis.site:5349 (TCP/TLS)"
echo "👤 User: voicechat"
echo "🔑 Pass: VoiceChatSecret2026!"
echo "=========================================="
