/**
 * claude-usage-bar — server.js
 *
 * Modo A: OAuth Claude Code — plan Max, zero config
 * Modo B: Playwright + sessionKey — plan Pro y Max
 *
 * Orden de resolucion de credenciales (sessionKey):
 *   1. Argumento SESSION_KEY (configurado manualmente en VS Code settings)
 *   2. Cookie sessionKey leida automaticamente de Chrome (Windows/Mac)
 *   3. Cookie sessionKey leida automaticamente de Edge (Windows)
 *
 * Flujo completo:
 *   - Plan Max + Claude Code instalado → OAuth directo, sin Playwright
 *   - Plan Pro + Chrome/Edge logueado en claude.ai → auto-lee sessionKey, sin configuracion
 *   - Plan Pro + sessionKey manual → Playwright con la key configurada
 *   - Ninguna credencial → error con mensaje de ayuda
 */

const OUTPUT_FILE = process.argv[2];
const SESSION_KEY  = process.argv[3] || '';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const POLL_INTERVAL_MS = 60000;

// -- Helpers ------------------------------------------------------------------

function writeOk(data, source) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    ok: true,
    five_hour:           Math.round(data?.five_hour?.utilization  ?? 0),
    five_hour_resets_at: data?.five_hour?.resets_at  ?? null,
    seven_day:           Math.round(data?.seven_day?.utilization  ?? 0),
    seven_day_resets_at: data?.seven_day?.resets_at  ?? null,
    seven_day_opus:      Math.round(data?.seven_day_opus?.utilization ?? 0),
    source,
    updated: new Date().toISOString(),
  }));
  process.stdout.write('ok\n');
}

function writeErr(msg) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ok: false, error: msg }));
  process.stdout.write('err: ' + msg + '\n');
}

// -- Credenciales Claude Code -------------------------------------------------

function readCredentials() {
  try {
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    return JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch {}
  return null;
}

function getClaudeCodeToken() {
  const creds = readCredentials();
  if (creds?.claudeAiOauth?.accessToken) return creds.claudeAiOauth.accessToken;

  if (process.platform === 'darwin') {
    try {
      const { execSync } = require('child_process');
      const raw  = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
      const data = JSON.parse(raw);
      if (data?.claudeAiOauth?.accessToken) return data.claudeAiOauth.accessToken;
    } catch {}
  }
  return null;
}

// Devuelve 'max' | 'pro' | 'unknown'
function getSubscriptionType() {
  const creds = readCredentials();
  const sub = creds?.claudeAiOauth?.subscriptionType?.toLowerCase() || 'unknown';
  if (sub.startsWith('max')) return 'max';
  if (sub === 'pro') return 'pro';
  return 'unknown';
}

// -- Auto-deteccion sessionKey desde Chrome / Edge ----------------------------

/**
 * Intenta leer la cookie sessionKey de claude.ai desde el perfil del navegador.
 * Funciona en Windows y Mac con Chrome y Edge.
 * Devuelve la sessionKey o null si no se puede leer.
 */
function getSessionKeyFromBrowser() {
  return new Promise((resolve) => {
    try {
      const chromeCookies = require('chrome-cookies-secure');
      const browsers = ['chrome', 'edge'];
      let attempted = 0;

      function tryNext(index) {
        if (index >= browsers.length) { resolve(null); return; }
        const browser = browsers[index];
        chromeCookies.getCookies('https://claude.ai', browser, (err, cookies) => {
          attempted++;
          if (!err && cookies?.sessionKey) {
            process.stdout.write(`sessionKey auto-detectada desde ${browser}\n`);
            resolve(cookies.sessionKey);
          } else {
            tryNext(index + 1);
          }
        });
      }

      tryNext(0);
    } catch (e) {
      // chrome-cookies-secure no disponible o error inesperado
      resolve(null);
    }
  });
}

// -- Modo A: OAuth (Max) ------------------------------------------------------

async function fetchViaOAuth(token) {
  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent':    'claude-code/2.1.92',
    },
  });
  if (res.ok) return await res.json();
  const err = new Error('oauth status ' + res.status);
  err.status = res.status;
  throw err;
}

// -- Modo B: Playwright -------------------------------------------------------

async function buildPlaywrightFetcher(sessionKey) {
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

  try {
    await page.goto('https://claude.ai', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch {}

  async function fetchUsage() {
    if (!orgId) {
      const bsRes = await page.evaluate(async () => {
        const r = await window.fetch('https://claude.ai/api/bootstrap', {
          credentials: 'include', headers: { Accept: 'application/json' },
        });
        return { status: r.status, body: await r.text() };
      });
      if (bsRes.status !== 200) throw new Error('bootstrap status ' + bsRes.status);
      const bs = JSON.parse(bsRes.body);
      orgId = bs?.account?.memberships?.[0]?.organization?.uuid;
      if (!orgId) throw new Error('no org id');
    }
    const usageRes = await page.evaluate(async (oid) => {
      const r = await window.fetch(`https://claude.ai/api/organizations/${oid}/usage`, {
        credentials: 'include', headers: { Accept: 'application/json' },
      });
      return { status: r.status, body: await r.text() };
    }, orgId);
    if (usageRes.status !== 200) throw new Error('usage status ' + usageRes.status);
    return JSON.parse(usageRes.body);
  }

  return { fetchUsage, browser };
}

async function runPlaywrightMode(sessionKey) {
  const { fetchUsage, browser } = await buildPlaywrightFetcher(sessionKey);

  async function poll() {
    try {
      const data = await fetchUsage();
      writeOk(data, 'claude-ai');
    } catch (e) {
      writeErr(e.message);
    }
  }

  await poll();
  setInterval(poll, POLL_INTERVAL_MS);

  process.on('SIGTERM', async () => { await browser.close(); process.exit(0); });
  process.on('SIGINT',  async () => { await browser.close(); process.exit(0); });
}

// -- Entry point --------------------------------------------------------------

async function run() {
  const subscriptionType = getSubscriptionType();
  const oauthToken       = getClaudeCodeToken();

  process.stdout.write(`plan detectado: ${subscriptionType}\n`);

  // 1. Plan Max + Claude Code → OAuth directo
  if (subscriptionType === 'max' && oauthToken) {
    try {
      const data = await fetchViaOAuth(oauthToken);
      writeOk(data, 'claude-code');
      setInterval(async () => {
        try {
          const fresh = getClaudeCodeToken() || oauthToken;
          writeOk(await fetchViaOAuth(fresh), 'claude-code');
        } catch (e) {
          if (e.status !== 401) writeErr(e.message);
        }
      }, POLL_INTERVAL_MS);
      return;
    } catch (e) {
      if (e.status !== 401) { writeErr(e.message); return; }
      process.stdout.write('OAuth 401 inesperado en Max → fallback Playwright\n');
    }
  }

  // 2. Resolver sessionKey: manual > Chrome/Edge auto-deteccion
  let resolvedKey = SESSION_KEY;

  if (!resolvedKey) {
    process.stdout.write('Sin sessionKey manual, intentando auto-deteccion desde navegador...\n');
    resolvedKey = await getSessionKeyFromBrowser();
  }

  if (!resolvedKey) {
    const hint = subscriptionType === 'pro'
      ? 'Plan Pro: abre claude.ai en Chrome o Edge, o configura claudeUsage.cookies en VS Code settings'
      : 'Configura claudeUsage.cookies en VS Code settings o abre claude.ai en Chrome/Edge';
    writeErr(hint);
    process.exit(1);
  }

  await runPlaywrightMode(resolvedKey);
}

run().catch(e => {
  writeErr(e.message);
  process.exit(1);
});
