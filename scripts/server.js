/**
 * claude-usage-bar — server.js
 *
 * Modo A: OAuth Claude Code (sin Playwright) — solo plan Max
 * Modo B: Playwright + sessionKey — plan Pro y Max
 *
 * Logica:
 *   1. Lee el plan desde .credentials.json
 *   2. Si es Max → intenta OAuth directamente (sin roundtrip fallido)
 *   3. Si es Pro o desconocido → va directo a Playwright si hay sessionKey
 *   4. Si OAuth falla con 401 (Max degradado a Pro?) → fallback a Playwright
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -- Lectura de credenciales --------------------------------------------------

function readCredentials() {
  try {
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    return JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch {}
  return null;
}

function getClaudeCodeToken() {
  // Metodo 1: .credentials.json (Windows, Linux, Mac moderno)
  const creds = readCredentials();
  if (creds?.claudeAiOauth?.accessToken) return creds.claudeAiOauth.accessToken;

  // Metodo 2: macOS Keychain (Mac antiguo)
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
  // max_5x, max_20x, max → todo lo que empiece por 'max' es Max
  if (sub.startsWith('max')) return 'max';
  if (sub === 'pro') return 'pro';
  return 'unknown';
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

// -- Modo B: Playwright (Pro y Max) -------------------------------------------

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

  // Plan Max con Claude Code → Modo A directo (sin Playwright)
  if (subscriptionType === 'max' && oauthToken) {
    try {
      const data = await fetchViaOAuth(oauthToken);
      writeOk(data, 'claude-code');
      setInterval(async () => {
        try {
          const fresh = getClaudeCodeToken() || oauthToken;
          writeOk(await fetchViaOAuth(fresh), 'claude-code');
        } catch (e) {
          // Si OAuth falla en polling → no es fatal, reintentar en siguiente ciclo
          if (e.status !== 401) writeErr(e.message);
        }
      }, POLL_INTERVAL_MS);
      return;
    } catch (e) {
      if (e.status === 401) {
        process.stdout.write('OAuth 401 inesperado en Max → fallback Playwright\n');
        // Caer a Playwright abajo
      } else {
        writeErr(e.message);
        return;
      }
    }
  }

  // Plan Pro, desconocido, o fallback desde Max con 401 → Modo B (Playwright)
  if (!SESSION_KEY) {
    const hint = subscriptionType === 'pro'
      ? 'Plan Pro detectado: configura claudeUsage.cookies con tu sessionKey de claude.ai'
      : 'No se encontraron credenciales validas. Configura claudeUsage.cookies en VS Code settings.';
    writeErr(hint);
    process.exit(1);
  }

  await runPlaywrightMode(SESSION_KEY);
}

run().catch(e => {
  writeErr(e.message);
  process.exit(1);
});
