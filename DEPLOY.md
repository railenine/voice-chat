# 🚀 Быстрый деплой на VPS

## TL;DR - Самый быстрый способ

```bash
# На VPS (Ubuntu 20.04+)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
git clone <your-repo> && cd voicechat
docker-compose up -d
```

Готово! Приложение работает на `http://your-vps-ip:3000`

---

## Подробная инструкция

### 1. Подготовка VPS

```bash
# Подключитесь к серверу
ssh root@your-vps-ip

# Обновите систему
apt update && apt upgrade -y

# Установите Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Проверьте установку
docker --version
docker-compose version
```

### 2. Деплой приложения

```bash
# Клонируйте репозиторий
git clone <your-repo-url>
cd voicechat

# Запустите приложение
docker-compose up -d

# Проверьте статус
docker-compose ps

# Посмотрите логи
docker-compose logs -f
```

### 3. Настройка домена (опционально)

```bash
# Установите Nginx
apt install nginx -y

# Создайте конфиг
cat > /etc/nginx/sites-available/voicechat << 'EOF'
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
    }
}
EOF

# Активируйте
ln -s /etc/nginx/sites-available/voicechat /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Установите SSL
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

### 4. Настройка firewall

```bash
# Откройте порты
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

---

## Альтернатива: PM2 (без Docker)

```bash
# Установите Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установите PM2
npm install -g pm2

# Клонируйте и соберите
git clone <your-repo>
cd voicechat
npm install
npm run build

# Запустите
pm2 start server/index.js --name voicechat
pm2 save
pm2 startup
```

---

## Проверка

```bash
# Health check
curl http://localhost:3000/health

# Должно вернуть:
# {"status":"ok","timestamp":"...","service":"voicechat-server"}
```

---

## Обновление

```bash
# Docker
git pull
docker-compose down
docker-compose up -d --build

# PM2
git pull
npm install
npm run build
pm2 restart voicechat
```

---

## Troubleshooting

**Порт 3000 занят:**
```bash
lsof -i :3000
kill -9 <PID>
```

**Docker не запускается:**
```bash
systemctl status docker
journalctl -u docker -n 50
```

**Приложение не отвечает:**
```bash
docker-compose logs voicechat
curl -v http://localhost:3000/health
```

---

## Мониторинг

```bash
# Docker
docker-compose ps
docker stats

# PM2
pm2 status
pm2 monit
pm2 logs voicechat
```

---

## Безопасность

1. **Смените SSH порт:**
```bash
nano /etc/ssh/sshd_config
# Port 2222
systemctl restart ssh
```

2. **Настройте fail2ban:**
```bash
apt install fail2ban -y
systemctl enable fail2ban
```

3. **Регулярные обновления:**
```bash
apt update && apt upgrade -y
```

---

## Поддержка

При проблемах создайте issue в репозитории или обратитесь к README.md
