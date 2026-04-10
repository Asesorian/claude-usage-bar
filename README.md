# Claude Usage Bar

Extension para **VS Code y Cursor** que muestra en tiempo real el uso de Claude — ventana de 5 horas y 7 dias — directamente en la barra de estado.

```
☁ CC 73% · 25%    ← Claude Code OAuth (plan Max)
☁ AI 73% · 25%    ← claude.ai sessionKey (plan Pro o Max)
```

Basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar), miembro de [SaaS Factory](https://www.saasfactory.so).

> ⚡ **Windows:** clona el repo y ejecuta `.\install.bat`. Listo.

> Ver los porcentajes no consume tokens ni cuota. Es una llamada HTTP, como consultar tu saldo.

---

## Que modo se aplica a ti?

| Situacion | Configuracion necesaria |
|---|---|
| Claude Code instalado + plan **Max** | **Ninguna** — OAuth automatico ✅ |
| Plan **Pro** (con o sin Claude Code) | sessionKey manual (ver abajo) |

> claude.ai y Claude Code comparten la misma cuota (plan Pro/Max). Los porcentajes son iguales independientemente del modo usado.

---

## Instalacion

### Windows (recomendado — one shot)

```bash
git clone https://github.com/Asesorian/claude-usage-bar.git
cd claude-usage-bar
.\install.bat
```

El script hace todo automaticamente:
1. Comprueba Node.js
2. Instala dependencias y compila TypeScript
3. Empaqueta la extension (.vsix)
4. Pre-instala Playwright + Chromium (~150 MB) — puede tardar 3-5 min la primera vez
5. Instala la extension en VS Code o Cursor

Reinicia VS Code / Cursor al terminar.

### Mac / Linux (manual)

```bash
git clone https://github.com/Asesorian/claude-usage-bar.git
cd claude-usage-bar
npm install
npm run compile
npx vsce package --no-dependencies --allow-missing-repository
code --install-extension claude-usage-bar-*.vsix
```

> La primera vez que se activa en VS Code instala Playwright + Chromium (~150 MB). Solo ocurre una vez.

---

## Configuracion sessionKey (plan Pro)

### 1. Obtén tu sessionKey

1. Abre [claude.ai](https://claude.ai) con sesion activa
2. `F12` → **Application** → **Cookies** → `https://claude.ai`
3. Copia el valor de la cookie `sessionKey`

### 2. Configurala en VS Code

```
Ctrl+Shift+P → Open User Settings (JSON)
```

```json
"claudeUsage.cookies": "sessionKey=sk-ant-XXXXXX..."
```

Guarda. En unos segundos apareceran los porcentajes en la barra.

> La sessionKey queda en texto plano en settings.json. Si tienes **Settings Sync** activado se sincroniza a la nube de Microsoft.

> La sessionKey es valida mientras tengas sesion activa en claude.ai. Si caduca, repite los pasos anteriores con el nuevo valor.

---

## Barra de estado

| Numero | Ventana |
|---|---|
| Primero | 5 horas |
| Segundo | 7 dias |

**Hover** → tabla completa con tiempo exacto hasta el reseteo y fuente activa.

**Colores:**
- Verde → menos del 80%
- Naranja → 80-90%
- Rojo → mas del 90%

---

## Compatibilidad

| Sistema | Max (OAuth) | Pro (sessionKey) | install.bat |
|---|---|---|---|
| Windows | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | ❌ manual |
| Linux | ✅ | ✅ | ❌ manual |

---

## Requisitos

- VS Code 1.80+ o Cursor
- Node.js (solo para compilar al instalar)
- **Max OAuth:** Claude Code instalado + plan Max
- **Pro sessionKey:** sessionKey de claude.ai en VS Code settings

---

## Desinstalar

```bash
code --uninstall-extension asesorian.claude-usage-bar
```

---

## Aviso

Esta extension usa la API OAuth interna de Anthropic y la API interna de claude.ai (no oficiales). Anthropic podria modificarlas en cualquier momento. Usala bajo tu propio criterio.

---

## Creditos

Basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar), miembro de [SaaS Factory](https://www.saasfactory.so) — comunidad de builders hispanohablantes liderada por Daniel Carreon.

Mejoras: OAuth automatico para plan Max, install.bat one-shot con pre-instalacion de deps, deteccion automatica de plan Pro/Max, soporte Mac Keychain, compatibilidad Windows/Mac/Linux.

Hecho con Claude Code.
