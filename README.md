# 🎤 VoiceChat - Голосовой чат в браузере

Веб-приложение для голосового общения в браузере с автоматической генерацией уникальных никнеймов. Использует WebRTC для peer-to-peer аудио связи.

## 🚀 Быстрый старт

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки (только фронтенд)
npm run dev

# Сборка и запуск с сервером
npm run build
node server/index.js
```

Приложение будет доступно по адресу: `http://localhost:3000`

### Docker (рекомендуется для VPS)

```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

## 🖥️ Деплой на VPS

### Вариант 1: Docker (рекомендуется)

1. **Подготовьте VPS** (Ubuntu 20.04+):
```bash
# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установите Docker Compose
sudo apt install docker-compose-plugin -y
```

2. **Клонируйте репозиторий**:
```bash
git clone <your-repo-url>
cd voicechat
```

3. **Запустите приложение**:
```bash
docker-compose up -d
```

4. **Настройте Nginx reverse proxy** (опционально, для HTTPS):
```bash
sudo apt install nginx -y
```

Создайте конфигурацию `/etc/nginx/sites-available/voicechat`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/voicechat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

5. **Настройте HTTPS** (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### Вариант 2: Без Docker (PM2)

1. **Установите Node.js 20+**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

2. **Установите PM2**:
```bash
sudo npm install -g pm2
```

3. **Клонируйте и настройте**:
```bash
git clone <your-repo-url>
cd voicechat
npm install
npm run build
```

4. **Запустите с PM2**:
```bash
pm2 start server/index.js --name voicechat
pm2 save
pm2 startup
```

5. **Управление**:
```bash
pm2 status          # Статус
pm2 logs voicechat  # Логи
pm2 restart voicechat  # Перезапуск
pm2 stop voicechat     # Остановка
```

### Вариант 3: Systemd (без PM2)

Создайте сервис `/etc/systemd/system/voicechat.service`:
```ini
[Unit]
Description=VoiceChat Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/voicechat
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Запустите:
```bash
sudo systemctl daemon-reload
sudo systemctl enable voicechat
sudo systemctl start voicechat
sudo systemctl status voicechat
```

## 🔧 Конфигурация

### Переменные окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Основные параметры:
- `PORT` - порт сервера (по умолчанию: 3000)
- `NODE_ENV` - режим работы (development/production)

### TURN сервер (для сложных сетей)

Если пользователи находятся за строгими файрволами, рекомендуется настроить TURN сервер:

1. Установите coturn:
```bash
sudo apt install coturn -y
```

2. Настройте `/etc/turnserver.conf`:
```
listening-port=3478
fingerprint
lt-cred-mech
user=username:password
realm=your-domain.com
```

3. Обновите `server/index.js` с TURN credentials.

## 📊 Мониторинг

### Проверка здоровья

```bash
curl http://localhost:3000/health
```

### Логи

```bash
# Docker
docker-compose logs -f voicechat

# PM2
pm2 logs voicechat

# Systemd
journalctl -u voicechat -f
```

### Статистика

Приложение автоматически логирует:
- Подключения/отключения клиентов
- Создание комнат
- Ошибки соединения

## 🔒 Безопасность

### Рекомендации для продакшена:

1. **HTTPS обязательно** - используйте Let's Encrypt
2. **Firewall** - откройте только необходимые порты:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/udp  # TURN server (если используется)
sudo ufw enable
```

3. **Rate limiting** - добавьте Nginx rate limiting:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location / {
    limit_req zone=api burst=20;
    proxy_pass http://localhost:3000;
}
```

4. **Обновления** - регулярно обновляйте зависимости:
```bash
npm audit
npm update
```

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                      Browser A                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  React Frontend (TypeScript + Tailwind CSS)      │  │
│  │  - Генерация никнейма                            │  │
│  │  - UI голосового чата                            │  │
│  │  - WebRTC управление                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            │ WebRTC (P2P Audio)
                            │
┌─────────────────────────────────────────────────────────┐
│                      Browser B                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  React Frontend (TypeScript + Tailwind CSS)      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket (Signaling)
                            │
┌─────────────────────────────────────────────────────────┐
│                    VPS Server                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Express + PeerJS Server                         │  │
│  │  - Signaling для WebRTC                          │  │
│  │  - Раздача статики (SPA)                         │  │
│  │  - Health checks                                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🐛 Troubleshooting

### Проблема: Не работает микрофон
**Решение**: Убедитесь что браузер имеет доступ к микрофону. Проверьте настройки разрешений.

### Проблема: Нет звука у участников
**Решение**: Проверьте что оба участника подключились к одной комнате. Проверьте логи сервера.

### Проблема: Высокая задержка
**Решение**: Проверьте качество интернет-соединения. Рассмотрите использование TURN сервера.

### Проблема: Docker не запускается
**Решение**: Проверьте что порт 3000 не занят:
```bash
sudo lsof -i :3000
```

## 📝 Лицензия

MIT

## 🤝 Поддержка

При возникновении проблем создайте issue в репозитории.
