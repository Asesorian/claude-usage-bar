/**
 * claude-usage-bar — server.js
 *
 * Modo A (prioritario): Lee el token OAuth de Claude Code desde
 *   ~/.claude/.credentials.json  (Windows, Linux, Mac con Claude Code ≥ 2.x)
 *   macOS Keychain               (Mac con versiones antiguas de Claude Code)
 *   → llama a https://api.anthropic.com/api/oauth/usage
 *   → sin Playwright, sin Chromium, sin configuración manual
 *
 * Modo B (fallback): sessionKey de claude.ai + Playwright headless (método original Joel Tabasco)
 *   → requiere configurar claudeUsage.cookies en VS Code settings
 *   → instala Playwright + Chromium (~150 MB) la primera vez
 *
 * Ambos modos devuelven el mismo formato JSON al OUTPUT_FILE.
 * Como claude.ai y Claude Code comparten la misma cuota (plan Max/Pro),
 * los porcentajes son equivalentes independientemente del modo usado.
 */

const OUTPUT_FILE = process.argv[2];
const SESSION_KEY  = process.argv[3] || '';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Helpers ──────────────────────────────────────────────────────────────────

function writeOk(data, source) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    ok: true,
    five_hour:          Math.round(data?.five_hour?.utilization  ?? 0),
    five_hour_resets_at: data?.five_hour?.resets_at  ?? null,
    seven_day:          Math.round(data?.seven_day?.utilization  ?? 0),
    seven_day_resets_at: data?.seven_day?.resets_at  ?? null,
    seven_day_opus:     Math.round(data?.seven_day_opus?.utilization ?? 0),
    source,
    updated: new Date().toISOString(),
  }));
  process.stdout.write('ok\n');
}

function writeErr(msg) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ok: false, error: msg }));
  process.stdout.write('err: ' + msg + '\n');
}

// ── Modo A: Claude Code OAuth ────────────────────────────────────────────────

/**
 * Obtiene el access token OAuth de Claude Code.
 * Intenta primero el fichero de credenciales (cross-platform),
 * luego macOS Keychain como fallback para versiones antiguas de Claude Code en Mac.
 */
function getClaudeCodeToken() {
  // Método 1: ~/.claude/.credentials.json  (Windows + Linux + Mac moderno)
  try {
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    const raw   = fs.readFileSync(credsPath, 'utf8');
    const data  = JSON.parse(raw);
    const token = data?.claudeAiOauth?.accessToken;
    if (token) return token;
  } catch {}

  // Método 2: macOS Keychain (Mac con Claude Code antiguo)
  if (process.platform === 'darwin') {
    try {
      const { execSync } = require('child_process');
      const raw   = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
      const data  = JSON.parse(raw);
      const token = data?.claudeAiOauth?.accessToken;
      if (token) return token;
    } catch {}
  }

  return null;
}

async function fetchViaOAuth(token) {
  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      'Accept':           'application/json, text/plain, */*',
      'Content-Type':     'application/json',
      'Authorization':    `Bearer ${token}`,
      'anthropic-beta':   'oauth-2025-04-20',
      'User-Agent':       'claude-code/2.1.92',
      'Accept-Encoding':  'gzip, compress, deflate, br',
    },
  });
  if (!res.ok) throw new Error('oauth status ' + res.status);
  return await res.json();
}

async function runOAuthMode(token) {
  async function poll() {
    try {
      const data = await fetchViaOAuth(token);
      writeOk(data, 'claude-code');
    } catch (e) {
      writeErr(e.message);
    }
  }
  await poll();
  setInterval(poll, 30000);
}

// ── Modo B: Playwright + sessionKey (método Joel Tabasco) ────────────────────

async function runPlaywrightMode(sessionKey) {
  const { chromium } = require('playwright-extra');
  const stealth = require('puppeteer-extra-plugin-stealth');
  chromium.use(stealth());

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  await ctx.addCookies([{ name: 'sessionKey', value: sessionKey, domain: 'claude.ai', path: '/' }]);

  const page = await ctx.newPage();
  let orgId = null;

  async function fetchUsage() {
    if (!orgId) {
      const bsRes = await page.evaluate(async () => {
        const r = await fetch('https://claude.ai/api/bootstrap', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        return { status: r.status, body: await r.text() };
      });
      if (bsRes.status !== 200) throw new Error('bootstrap status ' + bsRes.status);
      const bs = JSON.parse(bsRes.body);
      orgId = bs?.account?.memberships?.[0]?.organization?.uuid;
      if (!orgId) throw new Error('no org id');
    }

    const usageRes = await page.evaluate(async (oid) => {
      const r = await fetch(`https://claude.ai/api/organizations/${oid}/usage`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      return { status: r.status, body: await r.text() };
    }, orgId);

    if (usageRes.status !== 200) throw new Error('usage status ' + usageRes.status);
    return JSON.parse(usageRes.body);
  }

  try {
    await page.goto('https://claude.ai', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch {}

  async function poll() {
    try {
      const data = await fetchUsage();
      writeOk(data, 'claude-ai');
    } catch (e) {
      orgId = null;
      writeErr(e.message);
    }
  }

  await poll();
  setInterval(poll, 30000);

  process.on('SIGTERM', async () => { await browser.close(); process.exit(0); });
  process.on('SIGINT',  async () => { await browser.close(); process.exit(0); });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function run() {
  const oauthToken = getClaudeCodeToken();

  if (oauthToken) {
    // Modo A — sin Playwright, sin configuración manual
    await runOAuthMode(oauthToken);
  } else if (SESSION_KEY) {
    // Modo B — Playwright + sessionKey (fallback)
    await runPlaywrightMode(SESSION_KEY);
  } else {
    writeErr(
      'No se encontraron credenciales. ' +
      'Instala Claude Code o configura claudeUsage.cookies en VS Code settings.'
    );
    process.exit(1);
  }
}

run().catch(e => {
  writeErr(e.message);
  process.exit(1);
});
