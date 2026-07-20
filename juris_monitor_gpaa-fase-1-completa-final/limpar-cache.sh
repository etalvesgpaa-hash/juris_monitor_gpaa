#!/bin/bash

echo "🧹 Limpando cache e reinstalando dependências..."

# Remove node_modules
if [ -d "node_modules" ]; then
    echo "📦 Removendo node_modules..."
    rm -rf node_modules
fi

# Remove cache do Vite
if [ -d ".vite" ]; then
    echo "⚡ Removendo cache do Vite..."
    rm -rf .vite
fi

# Remove dist
if [ -d "dist" ]; then
    echo "🗑️  Removendo pasta dist..."
    rm -rf dist
fi

# Remove package-lock.json
if [ -f "package-lock.json" ]; then
    echo "🔒 Removendo package-lock.json..."
    rm -f package-lock.json
fi

# Reinstala dependências
echo "📥 Reinstalando dependências..."
npm install

echo "✅ Processo concluído!"
echo ""
echo "Agora execute: npm run dev"
