#!/bin/bash

echo "🔍 Диагностика VoiceChat сервера"
echo "=================================="
echo ""

# Проверка 1: Проверка процессов
echo "1️⃣  Проверка процессов Node.js..."
if pgrep -f "node.*server/index.js" > /dev/null; then
    echo "   ✅ Сервер запущен"
    pgrep -f "node.*server/index.js" | xargs ps -p
else
    echo "   ❌ Сервер не запущен"
fi
echo ""

# Проверка 2: Проверка PM2
echo "2️⃣  Проверка PM2..."
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "   ⚠️  PM2 не установлен"
fi
echo ""

# Проверка 3: Проверка Docker
echo "3️⃣  Проверка Docker..."
if command -v docker &> /dev/null; then
    if docker ps | grep -q voicechat; then
        echo "   ✅ Docker контейнер запущен"
        docker ps | grep voicechat
    else
        echo "   ❌ Docker контейнер не запущен"
    fi
else
    echo "   ⚠️  Docker не установлен"
fi
echo ""

# Проверка 4: Проверка портов
echo "4️⃣  Проверка портов..."
if command -v netstat &> /dev/null; then
    echo "   Слушающие порты:"
    sudo netstat -tulpn 2>/dev/null | grep LISTEN | grep -E ":(3000|80|443)" || echo "   Порты не найдены"
elif command -v ss &> /dev/null; then
    echo "   Слушающие порты:"
    ss -tulpn | grep -E ":(3000|80|443)" || echo "   Порты не найдены"
else
    echo "   ⚠️  netstat и ss не найдены"
fi
echo ""

# Проверка 5: Проверка dist директории
echo "5️⃣  Проверка dist директории..."
if [ -d "dist" ]; then
    echo "   ✅ dist директория существует"
    ls -lh dist/ | head -5
else
    echo "   ❌ dist директория не найдена"
    echo "   Запустите: npm run build"
fi
echo ""

# Проверка 6: Попытка подключения
echo "6️⃣  Попытка подключения к серверу..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
    echo "   ✅ Сервер отвечает на http://localhost:3000/health"
    curl -s http://localhost:3000/health | jq .
else
    echo "   ❌ Сервер не отвечает на http://localhost:3000/health"
fi
echo ""

echo "=================================="
echo "💡 Рекомендации:"
echo ""
echo "Если сервер не запущен:"
echo "  1. Прямой запуск: node server/index.js"
echo "  2. Через PM2: pm2 start server/index.js --name voicechat"
echo "  3. Через Docker: docker-compose up -d"
echo ""
echo "Если dist не существует:"
echo "  npm run build"
echo ""
echo "Если порт занят:"
echo "  sudo lsof -i :3000"
echo "  sudo kill -9 <PID>"
echo ""
