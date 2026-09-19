#!/bin/bash

# VoiceChat Server Start Script

echo "🎤 VoiceChat Server"
echo "==================="
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js 20 or higher"
    exit 1
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "📦 Building frontend..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Installation failed"
        exit 1
    fi
fi

echo "🚀 Starting server..."
echo ""

# Start server
node server/index.js
