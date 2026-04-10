# Claude Usage Bar

Extension para **VS Code y Cursor** que muestra en tiempo real el uso de Claude — ventana de 5 horas y 7 dias — directamente en la barra de estado.

```
☁ CC 73% · 25%    ← Claude Code OAuth (plan Max)
☁ AI 73% · 25%    ← claude.ai sessionKey (plan Pro o Max)
```

**Zero config en la mayoria de casos** — detecta automaticamente tus credenciales.
Basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar), miembro de [SaaS Factory](https://www.saasfactory.so).

> ⚡ **Windows:** clona el repo y ejecuta `.\install.bat`. Listo.

> Ver los porcentajes no consume tokens ni cuota. Es una llamada HTTP, como consultar tu saldo.

---

## Que modo se aplica a ti?

| Situacion | Configuracion necesaria |
|---|---|
| Claude Code instalado + plan **Max** | **Ninguna** — OAuth automatico ✅ |
| Plan **Pro** + Chrome o Edge abierto en claude.ai | **Ninguna** — auto-lee la cookie ✅ |
| Plan **Pro/Max** + Firefox | sessionKey manual (ver abajo) |
| Sin Claude Code y sin Chrome/Edge | sessionKey manual (ver abajo) |

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
4. La instala en VS Code o Cursor

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

> La primera vez que se activa instala Playwright + Chromium (~150 MB) y chrome-cookies-secure. Solo ocurre una vez, tarda ~2 min.

---

## Configuracion manual de sessionKey (solo si la auto-deteccion no funciona)

Necesario si usas Firefox o si chrome-cookies-secure no puede acceder a tu perfil de Chrome/Edge.

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

Guarda. En unos segundos apareceran los porcentajes.

> La sessionKey queda en texto plano en settings.json. Si tienes **Settings Sync** activado se sincroniza a la nube de Microsoft.

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

| Sistema | Max (OAuth) | Pro auto Chrome/Edge | Pro manual sessionKey | install.bat |
|---|---|---|---|---|
| Windows | ✅ | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | ✅ | ❌ manual |
| Linux | ✅ | ⚠️ solo Chrome | ✅ | ❌ manual |

---

## Requisitos

- VS Code 1.80+ o Cursor
- Node.js (solo para compilar al instalar)
- **Max OAuth:** Claude Code instalado + plan Max
- **Pro auto:** Chrome o Edge con sesion activa en claude.ai
- **Pro manual:** sessionKey de claude.ai en VS Code settings

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

Mejoras: zero-config para Pro via Chrome/Edge, OAuth para Max, install.bat one-shot, deteccion automatica plan, soporte Mac Keychain, compatibilidad Windows/Mac/Linux.

Hecho con Claude Code.
