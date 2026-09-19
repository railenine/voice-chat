# 🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С PEERJS

## 🐛 Проблема

WebSocket подключается к `wss://rvxis.site/peerjs/peerjs` вместо `wss://rvxis.site/peerjs`

При запросе `curl http://localhost:3000/peerjs/id` не возвращается UUID

---

## ✅ Правильная конфигурация PeerJS

### Сервер (`server/index.js`)

```javascript
const peerServer = ExpressPeerServer(server, {
  debug: 2,
  path: '/peerjs',  // ← Полный путь для PeerJS
  allow_discovery: true,
  concurrent_limit: 10000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }
});

// ВАЖНО: Без mount point!
app.use(peerServer);
```

### Клиент (`src/hooks/useVoiceChat.ts`)

```javascript
return {
  host: peerServerHost,
  port: port,
  path: '/peerjs',  // ← Полный путь
  secure: window.location.protocol === 'https:',
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
};
```

---

## 📋 Пошаговая инструкция по исправлению

### Шаг 1: Обновите файлы на сервере

```bash
# На локальной машине
scp server/index.js user@rvxis.site:/path/to/voicechat/server/
scp -r dist/* user@rvxis.site:/path/to/voicechat/dist/
```

### Шаг 2: Перезапустите сервер

```bash
# На VPS
cd /path/to/voicechat

# Если используете PM2:
pm2 restart voicechat
pm2 logs voicechat --lines 50

# Если используете systemd:
sudo systemctl restart voicechat
sudo journalctl -u voicechat -n 50

# Если используете Docker:
docker-compose restart
docker-compose logs --tail=50
```

### Шаг 3: Проверьте что сервер работает

```bash
# Проверка health check
curl http://localhost:3000/health

# Должно вернуть:
# {"status":"ok","timestamp":"...","service":"voicechat-server"}
```

### Шаг 4: Проверьте PeerJS endpoints

```bash
# Проверка /peerjs/id
curl http://localhost:3000/peerjs/id

# Должно вернуть UUID, например:
# 550e8400-e29b-41d4-a716-446655440000

# Проверка /peerjs/peers
curl http://localhost:3000/peerjs/peers

# Должно вернуть список пиров (может быть пустым):
# []
```

### Шаг 5: Используйте диагностический скрипт

```bash
# На VPS
node scripts/diagnose-peerjs.js

# Или укажите другой URL:
TEST_URL=http://localhost:3000 node scripts/diagnose-peerjs.js
```

### Шаг 6: Проверьте в браузере

1. Откройте `https://rvxis.site`
2. Откройте DevTools (F12)
3. Перейдите в Network → WS
4. Проверьте URL WebSocket:
   - ✅ Должно быть: `wss://rvxis.site/peerjs/peerjs`
   - ❌ НЕ должно быть: `wss://rvxis.site/peerjs/peerjs/peerjs`

---

## 🔍 Как это работает

### PeerJS архитектура

**Сервер** (`ExpressPeerServer`):
- `path: '/peerjs'` - базовый путь для PeerJS
- HTTP endpoints: `/peerjs/id`, `/peerjs/peers`
- WebSocket: `/peerjs/peerjs` (PeerJS добавляет `/peerjs` к path)

**Клиент** (`Peer`):
- `path: '/peerjs'` - базовый путь
- HTTP запросы: `/peerjs/id`, `/peerjs/peers`
- WebSocket: `/peerjs/peerjs`

### Почему `/peerjs/peerjs`?

Это **нормальное поведение** PeerJS!

PeerJS всегда добавляет `/peerjs` к указанному path для WebSocket соединений:

```javascript
// В исходном коде PeerJS
const wsUrl = `${protocol}://${host}:${port}${path}/peerjs`;
```

Поэтому:
- `path: '/peerjs'` → WebSocket: `/peerjs/peerjs` ✓
- `path: '/myapp'` → WebSocket: `/myapp/peerjs` ✓
- `path: ''` → WebSocket: `/peerjs` ✓ (но HTTP не работает!)

---

## ⚠️ Частые ошибки

### Ошибка 1: Использование mount point

```javascript
// ❌ НЕПРАВИЛЬНО
const peerServer = ExpressPrivacyServer(server, { path: '/peerjs' });
app.use('/peerjs', peerServer);  // Дублирование пути!
```

**Проблема**: Express mount point и PeerJS path дублируются

**Решение**: Используйте `app.use(peerServer)` без mount point

### Ошибка 2: Пустой path

```javascript
// ❌ НЕПРАВИЛЬНО
const peerServer = ExpressPrivacyServer(server, { path: '' });
app.use(peerServer);
```

**Проблема**: HTTP endpoints будут на `/id`, `/peers` вместо `/peerjs/id`

**Решение**: Используйте `path: '/peerjs'`

### Ошибка 3: Неправильная клиентская конфигурация

```javascript
// ❌ НЕПРАВИЛЬНО
{
  path: '',  // HTTP не будет работать!
}
```

**Проблема**: Клиент будет делать запросы на `/id` вместо `/peerjs/id`

**Решение**: Используйте `path: '/peerjs'`

---

## 🧪 Тестирование

### Локальное тестирование

```bash
# Запустите сервер
node server/index.js

# В другом терминале запустите диагностику
node scripts/diagnose-peerjs.js
```

### Ожидаемый результат

```
🔍 Диагностика PeerJS сервера
==============================

URL: http://localhost:3000

1️⃣  Проверка health check...
   ✅ Health check работает
   Ответ: {"status":"ok","timestamp":"...","service":"voicechat-server"}

2️⃣  Проверка PeerJS endpoints...

   📡 Проверка /peerjs/id...
   ✅ /peerjs/id работает
   UUID: 550e8400-e29b-41d4-a716-446655440000

   📡 Проверка /peerjs/peers...
   ✅ /peerjs/peers работает
   Ответ: []

   📡 Проверка /peerjs (без пути)...
   ✅ /peerjs работает
   Ответ: ...

==============================
✅ Диагностика завершена
```

---

## 📊 Проверочный чеклист

- [ ] Файлы обновлены на сервере
- [ ] Сервер перезапущен
- [ ] Health check работает (`curl http://localhost:3000/health`)
- [ ] `/peerjs/id` возвращает UUID (`curl http://localhost:3000/peerjs/id`)
- [ ] `/peerjs/peers` работает (`curl http://localhost:3000/peerjs/peers`)
- [ ] В браузере WebSocket подключается к `/peerjs/peerjs`
- [ ] Нет ошибок в консоли браузера
- [ ] Пользователи видят друг друга в комнате

---

## 🔧 Если проблема сохраняется

### Проверьте логи сервера

```bash
# PM2
pm2 logs voicechat

# Docker
docker-compose logs -f

# Systemd
journalctl -u voicechat -f
```

Ищите сообщения:
- ✅ `[PeerJS] Client connected: ...` - клиент подключился
- ❌ Ошибки WebSocket - проблема с конфигурацией

### Проверьте Nginx конфигурацию

Если используете Nginx reverse proxy:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Проверьте firewall

```bash
# Проверьте открытые порты
sudo ufw status

# Должны быть открыты:
# 80/tcp (HTTP)
# 443/tcp (HTTPS)
```

---

## 📝 Итоговая конфигурация

### Сервер (`server/index.js`)

```javascript
const peerServer = ExpressPeerServer(server, {
  debug: 2,
  path: '/peerjs',
  allow_discovery: true,
  concurrent_limit: 10000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }
});

app.use(peerServer);  // Без mount point!
```

### Клиент (`src/hooks/useVoiceChat.ts`)

```javascript
return {
  host: peerServerHost,
  port: port,
  path: '/peerjs',
  secure: window.location.protocol === 'https:',
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
};
```

### Ожидаемые пути

- HTTP: `/peerjs/id`, `/peerjs/peers` ✓
- WebSocket: `/peerjs/peerjs` ✓ (это нормально!)

---

**Дата**: 2026-03-19  
**Статус**: 🟡 ТРЕБУЕТСЯ ОБНОВЛЕНИЕ ФАЙЛОВ НА СЕРВЕРЕ
