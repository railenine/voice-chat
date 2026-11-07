# RVxis

Гостевой голосовой и текстовый чат с демонстрацией экрана.
Голос передаётся по WebRTC P2P mesh, экран — через LiveKit SFU.
React/TypeScript/Vite, Node.js/Express/WebSocket, desktop-оболочка Tauri v2.

- Голосовые комнаты с лимитом 12 участников; этот лимит не гарантирует качество на любых 12 устройствах.
- RNNoise и Web Audio обработка, индивидуальная громкость, mute/deafen.
- Чат и вложения в памяти сервера с ограничениями размера и времени хранения.
- Параметры capture экрана до 1440p30/1080p60; фактическое качество зависит от браузера и сети.
- Авторизация медиа через комнатную сессию и подпись portable-обновлений.

Сервер обрабатывает текст и файлы. RAM-only не исключает копии у участников,
инфраструктурные логи и запись разговора. LiveKit E2EE отдельно не настроен.
Подробности: [модель доступа](SECURITY_MODEL.md), [разработка и релизы](DEVELOPMENT.md),
[история](HISTORY.md). ARCHITECTURE.md содержит исторические детали, требующие сверки.

## 🚀 Быстрый старт

### Требования
- **Node.js** 22.22+
- **Rust** и **Cargo** (для сборки десктопного клиента Tauri)

### 1. Локальная разработка (Веб)
```bash
# Клонирование репозитория
git clone https://github.com/railenine/voice-chat.git
cd voice-chat

# Установка зависимостей
npm ci

# Терминал 1: backend на 3000
npm start

# Терминал 2: Vite с API/WS proxy на 5173
npm run dev

# Проверка типов и тестов (Unit, HTTP & WS Integration на реальных модулях)
npm run typecheck
npm test

# Проверки WebSocket-сигналинга
npm run test:signaling

# Настоящий браузерный smoke test голоса
npm run test:browser
```
Приложение откроется по адресу `http://localhost:5173`.

### 2. Запуск локального продакшн сервера
```bash
npm run build
npm start
```
Сервер будет доступен по адресу `http://localhost:3000`.

### 3. Запуск десктопного клиента (Tauri v2)
```bash
npm run desktop:dev
```

---

## 🖥️ Деплой на VPS

### Вариант 1: Docker Compose (рекомендуется)
```bash
# На вашем сервере (Ubuntu 20.04+)
git clone https://github.com/railenine/voice-chat.git
cd voice-chat

# Запуск контейнера в фоне
docker-compose up -d

# Проверка статуса
docker-compose ps
curl http://localhost:3000/health
```

### Вариант 2: PM2 / Systemd
```bash
npm install
npm run build
pm2 start server/index.js --name rvxis
pm2 save
pm2 startup
```

Полная конфигурация Nginx Reverse Proxy, LiveKit и Coturn приведена в **[ARCHITECTURE.md](ARCHITECTURE.md#10-развертывание-и-конфигурация-на-vps)**.

---

## 🧪 Тестирование

RVxis поставляется со встроенными наборами автотестов:

```bash
# Модульные тесты логики, безопасности, лимитов и звука (56 тестов)
npm test

# Комплексный стресс-тест P2P Mesh сети (72 проверки: 12 пиров, отказ 13-му, реконнект)
npm run test:mesh
```

---

## 📦 Релизы и версионирование

Для выпуска новой версии используется автоматизированный скрипт:
```bash
# Синхронизация версий во всех конфигурационных файлах и создание коммита/тега:
node scripts/bump-version.js 0.1.12 --push
```
GitHub Actions автоматически соберет кроссплатформенные бинарные файлы, подпишет их ключом Ed25519 и сгенерирует манифест автообновления `latest.json`.

---

## 📄 Лицензия

MIT License. Свободно для личного и коммерческого использования.
