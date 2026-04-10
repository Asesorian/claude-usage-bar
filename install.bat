@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo  ==========================================
echo   Claude Usage Bar — Instalador
echo  ==========================================
echo.

:: ── 1. Comprobar Node.js ──────────────────────────────────────────────────────
echo  [1/4] Comprobando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no encontrado.
    echo  Instálalo desde https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  OK: Node.js %%v

:: ── 2. Instalar dependencias y compilar ──────────────────────────────────────
echo.
echo  [2/4] Instalando dependencias y compilando...
call npm install --silent
if errorlevel 1 ( echo  ERROR en npm install & pause & exit /b 1 )
call npm run compile
if errorlevel 1 ( echo  ERROR en compilacion & pause & exit /b 1 )
echo  OK: Compilacion completada

:: ── 3. Instalar vsce y empaquetar ────────────────────────────────────────────
echo.
echo  [3/4] Empaquetando extension (.vsix)...
call npx vsce package --no-dependencies --allow-missing-repository 2>nul
if errorlevel 1 (
    call npm install -g @vscode/vsce --silent
    call vsce package --no-dependencies --allow-missing-repository
    if errorlevel 1 ( echo  ERROR empaquetando & pause & exit /b 1 )
)

:: Buscar el .vsix generado
set VSIX_FILE=
for %%f in (*.vsix) do set VSIX_FILE=%%f
if "!VSIX_FILE!"=="" (
    echo  ERROR: No se encontro el .vsix generado
    pause
    exit /b 1
)
echo  OK: Paquete generado: !VSIX_FILE!

:: ── 4. Instalar en VS Code ────────────────────────────────────────────────────
echo.
echo  [4/4] Instalando en VS Code...
code --install-extension "!VSIX_FILE!" >nul 2>&1
if errorlevel 1 (
    :: Intentar con Cursor si no hay code en PATH
    cursor --install-extension "!VSIX_FILE!" >nul 2>&1
    if errorlevel 1 (
        echo  AVISO: No se pudo instalar automaticamente.
        echo  Instala manualmente:
        echo    Ctrl+Shift+P -^> Extensions: Install from VSIX... -^> !VSIX_FILE!
        pause
        exit /b 0
    )
    echo  OK: Instalado en Cursor
) else (
    echo  OK: Instalado en VS Code
)

echo.
echo  ==========================================
echo   Listo! Reinicia VS Code / Cursor
echo   para ver Claude Usage Bar en la barra.
echo  ==========================================
echo.
pause
