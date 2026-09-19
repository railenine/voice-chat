# ⚡ Быстрый старт

## Локально (для разработки)

```bash
npm install
npm run dev
# Откройте http://localhost:5173
```

## Локально (с сервером)

```bash
npm install
npm run build
node server/index.js
# Откройте http://localhost:3000
```

## На VPS (Docker)

```bash
# Установите Docker
curl -fsSL https://get.docker.com | sh

# Запустите
git clone <repo>
cd voicechat
docker-compose up -d

# Готово! http://your-vps-ip:3000
```

## На VPS (без Docker)

```bash
# Установите Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установите PM2
npm install -g pm2

# Запустите
git clone <repo>
cd voicechat
npm install
npm run build
pm2 start server/index.js --name voicechat
pm2 save
pm2 startup
```

---

**Документация:**
- 📖 [README.md](README.md) - полная документация
- 🚀 [DEPLOY.md](DEPLOY.md) - подробная инструкция по деплою
