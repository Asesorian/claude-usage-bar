# ☁️ Claude Usage Bar

Extensión para **VS Code y Cursor** que muestra en tiempo real el uso de Claude — ventana de 5 horas y 7 días — directamente en la barra de estado.

```
☁ CC 73% · 25%
```

**Auto-detecta Claude Code** — si lo tienes instalado, funciona sin configuración. Para quienes no usan Claude Code, incluye el método alternativo vía sessionKey (basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar)).

---

## ¿Qué modo se aplica a ti?

| Situación | Modo | Setup |
|---|---|---|
| Tienes Claude Code instalado | **A — OAuth automático** | Ninguno ✅ |
| No tienes Claude Code | **B — sessionKey** | Requiere configuración |

> **Nota:** claude.ai y Claude Code comparten la misma cuota (plan Pro/Max). Los porcentajes son equivalentes en ambos modos.

---

## Modo A — Claude Code (recomendado, zero config)

Si tienes Claude Code instalado, la extensión detecta automáticamente tus credenciales:

- **Windows / Linux:** lee `~/.claude/.credentials.json`
- **Mac (Claude Code moderno):** mismo fichero
- **Mac (Claude Code antiguo):** macOS Keychain como fallback

No necesitas configurar nada. Instala la extensión y listo.

**Ventajas sobre Modo B:**
- Sin Playwright ni Chromium (~150 MB ahorrados)
- Sin sessionKey que caduque
- Arranque instantáneo

---

## Modo B — sessionKey (sin Claude Code)

Solo necesario si no usas Claude Code.

### 1. Instala la extensión desde `.vsix`

Ve a [Releases](../../releases), descarga el `.vsix` e instala:
```
Ctrl+Shift+P → Extensions: Install from VSIX...
```

> ⏳ **Primera vez:** instala Playwright + Chromium (~150 MB). Tarda ~2 min. Solo ocurre una vez.

### 2. Obtén tu sessionKey

1. Abre [claude.ai](https://claude.ai) con sesión activa
2. `F12` → **Application** → **Cookies** → `https://claude.ai`
3. Copia el valor de `sessionKey`

### 3. Configura la extensión

```
Ctrl+Shift+P → Open User Settings (JSON)
```

```json
"claudeUsage.cookies": "sessionKey=sk-ant-XXXXXX..."
```

> ⚠️ La `sessionKey` queda en texto plano en settings.json. Si tienes **Settings Sync** activado, se sincroniza a la nube de Microsoft. Tenlo en cuenta.

---

## Barra de estado

```
☁ CC 73% · 25%    ← Claude Code OAuth (Modo A)
☁ AI 73% · 25%    ← claude.ai sessionKey (Modo B)
```

| Número | Ventana |
|---|---|
| Primero | 5 horas |
| Segundo | 7 días |

**Hover** → tabla completa con tiempo exacto hasta el reseteo de cada ventana.

**Colores:**
- 🟢 Verde: < 80%
- 🟠 Naranja: 80–90%
- 🔴 Rojo: > 90%

---

## Compatibilidad

| Sistema | Modo A | Modo B |
|---|---|---|
| Windows | ✅ | ✅ |
| macOS | ✅ | ✅ |
| Linux | ✅ | ✅ |

---

## Requisitos

- VS Code 1.80+ o Cursor
- **Modo A:** Claude Code instalado (cualquier versión)
- **Modo B:** Node.js instalado + sessionKey de claude.ai

---

## ⚠️ Aviso

Esta extensión usa la API OAuth interna de Anthropic y la API interna de claude.ai (no oficiales). Anthropic podría modificarlas en cualquier momento. Úsala bajo tu propio criterio.

---

## Créditos

Basado en el trabajo original de [Joel Tabasco](https://github.com/jtabasco/claude-usage-bar), miembro de [SaaS Factory](https://www.saasfactory.so) — comunidad de builders hispanohablantes liderada por Daniel Carreón.  
Mejoras: detección automática Claude Code, soporte Mac Keychain, modo OAuth sin Playwright, compatibilidad Windows/Mac/Linux.

Hecho con ☁️ + [Claude Code](https://claude.ai/code)
