/**
 * claude-usage-bar — server.js
 *
 * Modo A: OAuth Claude Code (sin Playwright) — funciona en plan Max
 * Modo B: Playwright + sessionKey — funciona en Pro y Max
 *
 * Logica: intenta Modo A primero. Si falla con 401 (plan Pro),
 * cae automaticamente a Modo B si hay sessionKey disponible.
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

// -- Modo A: OAuth ------------------------------------------------------------

function getClaudeCodeToken() {
  try {
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    const data  = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const token = data?.claudeAiOauth?.accessToken;
    if (token) return token;
  } catch {}

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

// Devuelve los datos de uso, o lanza error con .status para distinguir 401 vs otros
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

  async function fetch() {
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

  return { fetch, browser };
}

// -- Entry point --------------------------------------------------------------

async function run() {
  const oauthToken = getClaudeCodeToken();

  // Intentar Modo A primero
  if (oauthToken) {
    try {
      const data = await fetchViaOAuth(oauthToken);
      writeOk(data, 'claude-code');
      // Modo A funciona — seguir con polling OAuth
      setInterval(async () => {
        try {
          const freshToken = getClaudeCodeToken() || oauthToken;
          const d = await fetchViaOAuth(freshToken);
          writeOk(d, 'claude-code');
        } catch (e) {
          writeErr(e.message);
        }
      }, POLL_INTERVAL_MS);
      return;
    } catch (e) {
      if (e.status === 401) {
        process.stdout.write('OAuth 401 (plan Pro) — cambiando a Modo B (Playwright)\n');
        // Caer a Modo B abajo
      } else {
        writeErr(e.message);
        // Reintentar en el siguiente poll
        setInterval(async () => {
          try {
            const freshToken = getClaudeCodeToken() || oauthToken;
            const d = await fetchViaOAuth(freshToken);
            writeOk(d, 'claude-code');
          } catch (e2) { writeErr(e2.message); }
        }, POLL_INTERVAL_MS);
        return;
      }
    }
  }

  // Modo B: Playwright + sessionKey
  if (!SESSION_KEY) {
    writeErr('Plan Pro detectado: configura claudeUsage.cookies con tu sessionKey de claude.ai');
    process.exit(1);
  }

  const { fetch: playwrightFetch, browser } = await buildPlaywrightFetcher(SESSION_KEY);

  async function poll() {
    try {
      const data = await playwrightFetch();
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

run().catch(e => {
  writeErr(e.message);
  process.exit(1);
});
