@echo off
setlocal enabledelayedexpansion

echo.
echo  ==========================================
echo   Claude Usage Bar - Instalador
echo  ==========================================
echo.

:: 1. Comprobar Node.js
echo  [1/5] Comprobando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no encontrado.
    echo  Instalalo desde https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  OK: Node.js %%v

:: 2. Instalar dependencias y compilar
echo.
echo  [2/5] Instalando dependencias y compilando...
call npm install --silent
if errorlevel 1 ( echo  ERROR en npm install & pause & exit /b 1 )
call npm run compile
if errorlevel 1 ( echo  ERROR en compilacion & pause & exit /b 1 )
echo  OK: Compilacion completada

:: 3. Empaquetar
echo.
echo  [3/5] Empaquetando extension (.vsix)...
call npx vsce package --no-dependencies --allow-missing-repository
if errorlevel 1 (
    call npm install -g @vscode/vsce --silent
    call vsce package --no-dependencies --allow-missing-repository
    if errorlevel 1 ( echo  ERROR empaquetando & pause & exit /b 1 )
)

set VSIX_FILE=
for %%f in (*.vsix) do set VSIX_FILE=%%f
if "!VSIX_FILE!"=="" (
    echo  ERROR: No se encontro el .vsix generado
    pause
    exit /b 1
)
echo  OK: Paquete generado: !VSIX_FILE!

:: 4. Pre-instalar deps runtime en globalStorage (evita espera dentro de VS Code)
echo.
echo  [4/5] Pre-instalando dependencias runtime (Playwright + chromium)...
echo  Esto puede tardar 3-5 minutos la primera vez (descarga ~150 MB)...
echo  Por favor espera sin cerrar esta ventana.
echo.

set STORAGE_DIR=%APPDATA%\Code\User\globalStorage\asesorian.claude-usage-bar
if not exist "!STORAGE_DIR!" mkdir "!STORAGE_DIR!"

set DEPS_MARKER=!STORAGE_DIR!\node_modules\playwright-extra
if exist "!DEPS_MARKER!" (
    echo  OK: Dependencias ya instaladas, saltando...
) else (
    copy /Y "scripts\package.json" "!STORAGE_DIR!\package.json" >nul
    copy /Y "scripts\server.js" "!STORAGE_DIR!\server.js" >nul
    pushd "!STORAGE_DIR!"
    call npm install --silent
    if errorlevel 1 ( popd & echo  ERROR instalando deps runtime & pause & exit /b 1 )
    call npx playwright install chromium
    if errorlevel 1 ( popd & echo  ERROR instalando Chromium & pause & exit /b 1 )
    popd
    echo  OK: Dependencias runtime instaladas
)

:: 5. Instalar extension en VS Code o Cursor
echo.
echo  [5/5] Instalando extension...
code --install-extension "!VSIX_FILE!"
if errorlevel 1 (
    cursor --install-extension "!VSIX_FILE!"
    if errorlevel 1 (
        echo.
        echo  AVISO: Instala manualmente:
        echo  Ctrl+Shift+P - Extensions: Install from VSIX... - !VSIX_FILE!
        pause
        exit /b 0
    )
    echo  OK: Instalado en Cursor
) else (
    echo  OK: Instalado en VS Code
)

echo.
echo  ==========================================
echo   Listo! Reinicia VS Code / Cursor.
echo   Los porcentajes apareceran en la barra
echo   de estado al arrancar.
echo  ==========================================
echo.
pause
