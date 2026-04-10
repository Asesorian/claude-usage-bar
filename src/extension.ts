import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess, exec } from 'child_process';

let statusBarItem: vscode.StatusBarItem;
let pollTimer: NodeJS.Timeout | undefined;
let serverProcess: ChildProcess | undefined;
let usageFile: string;
let storageDir: string;

// -- Deteccion plan y credenciales -------------------------------------------

function readClaudeCredentials(): any {
  try {
    const credsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    return JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch {}
  return null;
}

function getClaudeCodeToken(): string | null {
  const creds = readClaudeCredentials();
  if (creds?.claudeAiOauth?.accessToken) return creds.claudeAiOauth.accessToken;
  if (process.platform === 'darwin') return 'keychain-pending';
  return null;
}

function getSubscriptionType(): 'max' | 'pro' | 'unknown' {
  const creds = readClaudeCredentials();
  const sub = (creds?.claudeAiOauth?.subscriptionType || '').toLowerCase();
  if (sub.startsWith('max')) return 'max';
  if (sub === 'pro') return 'pro';
  return 'unknown';
}

// -- Activacion --------------------------------------------------------------

export async function activate(context: vscode.ExtensionContext) {
  storageDir = context.globalStorageUri.fsPath;
  usageFile  = path.join(storageDir, 'claude-usage.json');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  statusBarItem.tooltip = 'Claude usage — click to refresh';
  statusBarItem.command = 'claudeUsage.refresh';
  statusBarItem.text = '$(cloud) Claude...';
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand('claudeUsage.refresh', () => restartServer(context))
  );

  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('claudeUsage.cookies')) restartServer(context);
  });

  await ensureSetup(context);
  startServer(context);
  pollTimer = setInterval(readAndShow, 5000);
}

// -- Setup -------------------------------------------------------------------

async function ensureSetup(context: vscode.ExtensionContext) {
  fs.mkdirSync(storageDir, { recursive: true });

  // Siempre copiar el server.js mas reciente
  const src = path.join(context.extensionPath, 'scripts', 'server.js');
  const dst = path.join(storageDir, 'server.js');
  fs.copyFileSync(src, dst);

  const subType      = getSubscriptionType();
  const hasClaudeCode = getClaudeCodeToken() !== null;

  // Plan Max + Claude Code: solo necesita OAuth, no Playwright
  if (subType === 'max' && hasClaudeCode) {
    statusBarItem.text = '$(cloud) Claude: listo (Max, OAuth)';
    return;
  }

  // Cualquier otro caso: instalar deps (Playwright + chrome-cookies-secure)
  const depsMarker = path.join(storageDir, 'node_modules', 'playwright-extra');
  if (!fs.existsSync(depsMarker)) {
    const pkgSrc = path.join(context.extensionPath, 'scripts', 'package.json');
    const pkgDst = path.join(storageDir, 'package.json');
    fs.copyFileSync(pkgSrc, pkgDst);

    statusBarItem.text = '$(sync~spin) Claude: instalando dependencias (1 vez, ~2 min)...';
    await runCommand('npm install', storageDir);
    await runCommand('npx playwright install chromium', storageDir);
  }

  statusBarItem.text = '$(cloud) Claude: listo';
}

function runCommand(cmd: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      { cwd, timeout: 300_000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' },
      (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      }
    );
  });
}

// -- Servidor ----------------------------------------------------------------

function startServer(context: vscode.ExtensionContext) {
  const cookies   = vscode.workspace.getConfiguration('claudeUsage').get<string>('cookies', '').trim();
  const match     = cookies.match(/sessionKey=([^;]+)/);
  const sessionKey = match ? match[1].trim() : cookies.trim();

  const serverScript = path.join(storageDir, 'server.js');

  // Pasar sessionKey si hay. Si no, server.js intentara auto-deteccion desde Chrome/Edge
  const args = sessionKey
    ? [serverScript, usageFile, sessionKey]
    : [serverScript, usageFile];

  serverProcess = spawn('node', args, {
    cwd: storageDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', () => readAndShow());
  serverProcess.stderr?.on('data', (d: Buffer) => console.error('[claude-usage]', d.toString()));
  serverProcess.on('exit', code => {
    if (code !== 0 && code !== null) {
      statusBarItem.text = '$(cloud) Claude: reiniciando...';
    }
  });
}

function restartServer(context: vscode.ExtensionContext) {
  if (serverProcess) { serverProcess.kill(); serverProcess = undefined; }
  startServer(context);
}

// -- Barra de estado ---------------------------------------------------------

function readAndShow() {
  try {
    if (!fs.existsSync(usageFile)) return;
    const data = JSON.parse(fs.readFileSync(usageFile, 'utf8'));

    if (data.ok) {
      const src = data.source === 'claude-code' ? 'CC' : 'AI';
      statusBarItem.text = `$(cloud) ${src} ${data.five_hour}% · ${data.seven_day}%`;
      statusBarItem.tooltip = buildTooltip(data);

      if (data.five_hour >= 90) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      } else if (data.five_hour >= 80) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      } else {
        statusBarItem.backgroundColor = undefined;
        statusBarItem.color = '#4CAF50';
      }
    } else {
      statusBarItem.text = '$(cloud) Claude: error';
      const errMd = new vscode.MarkdownString(`**Error:** ${data.error}\n\n*Click para reintentar*`);
      statusBarItem.tooltip = errMd;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  } catch { /* fichero aun no listo */ }
}

function timeUntil(isoDate: string | null): string {
  if (!isoDate) return '-';
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'reseteando...';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildTooltip(data: any): vscode.MarkdownString {
  const r5 = timeUntil(data.five_hour_resets_at);
  const r7 = timeUntil(data.seven_day_resets_at);
  const sourceLabel = data.source === 'claude-code' ? 'Claude Code (OAuth)' : 'claude.ai (sessionKey)';
  const opusRow = data.seven_day_opus > 0 ? `| Opus 7d | ${data.seven_day_opus}% | - |\n` : '';

  const md = new vscode.MarkdownString(
    `**Claude Usage** *(click to refresh)*\n\n` +
    `| | Uso | Resetea en |\n|---|---|---|\n` +
    `| 5h | ${data.five_hour}% | ${r5} |\n` +
    `| 7d | ${data.seven_day}% | ${r7} |\n` +
    opusRow +
    `\n*Fuente: ${sourceLabel}*\n` +
    `*Actualizado: ${new Date(data.updated).toLocaleTimeString()}*`
  );
  md.isTrusted = true;
  return md;
}

// -- Desactivacion -----------------------------------------------------------

export function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
  if (serverProcess) serverProcess.kill();
}
