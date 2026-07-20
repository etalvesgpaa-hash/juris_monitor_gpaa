@echo off
echo 🧹 Limpando cache e reinstalando dependências...
echo.

REM Remove node_modules
if exist "node_modules" (
    echo 📦 Removendo node_modules...
    rmdir /s /q node_modules
)

REM Remove cache do Vite
if exist ".vite" (
    echo ⚡ Removendo cache do Vite...
    rmdir /s /q .vite
)

REM Remove dist
if exist "dist" (
    echo 🗑️  Removendo pasta dist...
    rmdir /s /q dist
)

REM Remove package-lock.json
if exist "package-lock.json" (
    echo 🔒 Removendo package-lock.json...
    del /f package-lock.json
)

echo.
echo 📥 Reinstalando dependências...
call npm install

echo.
echo ✅ Processo concluído!
echo.
echo Agora execute: npm run dev
pause
