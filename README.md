# ☁️ Claude Usage Bar

Extension para **VS Code y Cursor** que muestra en tiempo real el uso de Claude — ventana de 5 horas y 7 dias — directamente en la barra de estado.

```
☁ CC 73% · 25%    ← Claude Code OAuth (plan Max)
☁ AI 73% · 25%    ← claude.ai sessionKey (plan Pro o Max)
```

**Auto-detecta Claude Code** si lo tienes instalado. Para plan Pro o sin Claude Code, usa sessionKey (basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar), miembro de [SaaS Factory](https://www.saasfactory.so)).

> ⚡ **Instalacion en un solo paso (Windows):** clona el repo, ejecuta `.\install.bat` y listo.

> **Nota:** Ver los porcentajes de uso no consume tokens ni cuota. Es una llamada HTTP simple, equivalente a consultar tu saldo.

---

## Que modo se aplica a ti?

| Situacion | Modo | Setup |
|---|---|---|
| Claude Code instalado + plan **Max** | **A — OAuth automatico** | Ninguno ✅ |
| Claude Code instalado + plan **Pro** | **B — sessionKey** | Requiere configuracion |
| Sin Claude Code | **B — sessionKey** | Requiere configuracion |

> **Nota:** claude.ai y Claude Code comparten la misma cuota (plan Pro/Max). Los porcentajes son equivalentes en ambos modos.

---

## Instalacion rapida (Windows)

```bash
git clone https://github.com/Asesorian/claude-usage-bar.git
cd claude-usage-bar
.\install.bat
```

El script hace todo automaticamente:
1. Comprueba Node.js
2. Instala dependencias y compila TypeScript
3. Empaqueta la extension (.vsix)
4. La instala en VS Code o Cursor

Reinicia VS Code / Cursor al terminar.

---

## Modo A — Claude Code OAuth (plan Max, zero config)

Si tienes Claude Code instalado y plan **Max**, la extension detecta las credenciales automaticamente:

- **Windows / Linux:** lee `~/.claude/.credentials.json`
- **Mac (Claude Code moderno):** mismo fichero
- **Mac (Claude Code antiguo):** macOS Keychain como fallback

No necesitas configurar nada.

**Ventajas:**
- Sin Playwright ni Chromium (~150 MB ahorrados)
- Sin sessionKey que caduque
- Arranque instantaneo

---

## Modo B — sessionKey (plan Pro o sin Claude Code)

### 1. Instala la extension

**Windows:** usa `.\install.bat` (ver arriba).

**Mac / Linux — manual:**
```bash
npm install
npm run compile
npx vsce package --no-dependencies --allow-missing-repository
code --install-extension claude-usage-bar-*.vsix
```

> La primera vez que se activa en VS Code instala Playwright + Chromium (~150 MB). Solo ocurre una vez, tarda ~2 min.

### 2. Obtén tu sessionKey

1. Abre [claude.ai](https://claude.ai) con sesion activa
2. `F12` → **Application** → **Cookies** → `https://claude.ai`
3. Copia el valor de la cookie `sessionKey`

### 3. Configura la extension

```
Ctrl+Shift+P → Open User Settings (JSON)
```

Añade esta linea (con coma en la linea anterior si no es la ultima):

```json
"claudeUsage.cookies": "sessionKey=sk-ant-XXXXXX..."
```

Guarda. En ~15 segundos apareceran los porcentajes en la barra.

> ⚠️ La sessionKey queda en texto plano en settings.json. Si tienes **Settings Sync** activado se sincroniza a la nube de Microsoft. Tenlo en cuenta.

---

## Barra de estado

| Numero | Ventana |
|---|---|
| Primero | 5 horas |
| Segundo | 7 dias |

**Hover** → tabla completa con tiempo exacto hasta el reseteo de cada ventana.

**Colores:**
- Verde: menos del 80%
- Naranja: 80-90%
- Rojo: mas del 90%

---

## Compatibilidad

| Sistema | Modo A (Max) | Modo B (Pro/Max) | install.bat |
|---|---|---|---|
| Windows | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | ❌ manual |
| Linux | ✅ | ✅ | ❌ manual |

---

## Requisitos

- VS Code 1.80+ o Cursor
- Node.js instalado (solo para compilar al instalar)
- **Modo A:** Claude Code + plan Max
- **Modo B:** sessionKey de claude.ai (plan Pro o Max)

---

## Desinstalar

```bash
code --uninstall-extension asesorian.claude-usage-bar
```

---

## ⚠️ Aviso

Esta extension usa la API OAuth interna de Anthropic y la API interna de claude.ai (no oficiales). Anthropic podria modificarlas en cualquier momento. Usala bajo tu propio criterio.

---

## Creditos

Basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar), miembro de [SaaS Factory](https://www.saasfactory.so) — comunidad de builders hispanohablantes liderada por Daniel Carreon.
Mejoras: instalador one-shot (install.bat), deteccion automatica Claude Code, soporte Mac Keychain, fallback automatico OAuth→Playwright, compatibilidad Windows/Mac/Linux.

Hecho con ☁️ + [Claude Code](https://claude.ai/code)
