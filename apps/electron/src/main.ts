import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import path from 'path';

const isDev = process.env['NODE_ENV'] === 'development';

// ── Config ─────────────────────────────────────────────────────────────────────

export interface Config {
  apiEndpoint: string;
  apiKey:      string;
  events: {
    activeApp:  boolean;
    screenLock: boolean;
    idle:       boolean;
    battery:    boolean;
  };
  blockedApps: string[];
}

const DEFAULT_CONFIG: Config = {
  apiEndpoint: 'http://localhost:3200',
  apiKey:      '',
  events: {
    activeApp:  true,
    screenLock: true,
    idle:       true,
    battery:    true,
  },
  blockedApps: [],
};

const configPath = join(app.getPath('userData'), 'kairosis-config.json');
let config: Config = { ...DEFAULT_CONFIG };

function loadConfig(): void {
  if (!existsSync(configPath)) return;
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<Config>;
    config = {
      ...DEFAULT_CONFIG,
      ...raw,
      events:      { ...DEFAULT_CONFIG.events,      ...(raw.events ?? {}) },
      blockedApps: Array.isArray(raw.blockedApps) ? raw.blockedApps : [],
    };
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
}

function saveConfig(): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// ── Status ─────────────────────────────────────────────────────────────────────

interface Status {
  connected: boolean | null;
  lastAt:    string | null;
  error:     string | null;
}

let status: Status = { connected: null, lastAt: null, error: null };

// ── Event sender ───────────────────────────────────────────────────────────────

async function sendEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  if (!config.apiEndpoint || !config.apiKey) return;
  try {
    const res = await fetch(`${config.apiEndpoint}/ingest/desktop`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ type, ...payload }),
    });
    status = {
      connected: res.ok,
      lastAt:    new Date().toISOString(),
      error:     res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    status = { connected: false, lastAt: new Date().toISOString(), error: String(err) };
  }
}

// ── Active app ─────────────────────────────────────────────────────────────────

interface ActiveApp { name: string; bundleId: string }

function getActiveApp(): ActiveApp | null {
  try {
    const out = execSync(
      `osascript -e 'tell application "System Events"\nset f to first application process whose frontmost is true\nreturn (name of f) & "|" & (bundle identifier of f)\nend tell'`,
      { timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] },
    ).toString().trim();
    const [name, bundleId] = out.split('|');
    if (!name?.trim()) return null;
    return { name: name.trim(), bundleId: (bundleId ?? '').trim() };
  } catch {
    return null;
  }
}

let lastActiveApp: string | null = null;
let activeAppTimer: ReturnType<typeof setInterval> | null = null;

function startActiveAppCollector(): void {
  if (activeAppTimer) clearInterval(activeAppTimer);
  activeAppTimer = setInterval(async () => {
    if (!config.events.activeApp) return;
    const active = getActiveApp();
    if (!active) return;
    if (active.name === lastActiveApp) return;
    if (config.blockedApps.some((b) => b.toLowerCase() === active.name.toLowerCase())) {
      lastActiveApp = active.name;
      return;
    }
    lastActiveApp = active.name;
    await sendEvent('app.activated', { appName: active.name, bundleId: active.bundleId });
  }, 5_000);
}

// ── Idle detection ─────────────────────────────────────────────────────────────

const IDLE_THRESHOLD_SECS = 120;
let isIdle = false;
let idleTimer: ReturnType<typeof setInterval> | null = null;

function startIdleCollector(): void {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(async () => {
    if (!config.events.idle) return;
    const idleSecs = powerMonitor.getSystemIdleTime();
    if (idleSecs >= IDLE_THRESHOLD_SECS && !isIdle) {
      isIdle = true;
      await sendEvent('idle.started', { idleSeconds: idleSecs });
    } else if (idleSecs < 5 && isIdle) {
      isIdle = false;
      await sendEvent('idle.ended', {});
    }
  }, 30_000);
}

// ── Window ─────────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width:      420,
    height:     580,
    resizable:  false,
    maximizable: false,
    title:      'Kairosis',
    titleBarStyle:          'hiddenInset',
    trafficLightPosition:   { x: 16, y: 16 },
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:4000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  return win;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  loadConfig();

  powerMonitor.on('lock-screen', () => {
    if (!config.events.screenLock) return;
    sendEvent('screen.locked', {});
  });

  powerMonitor.on('unlock-screen', () => {
    if (!config.events.screenLock) return;
    sendEvent('screen.unlocked', {});
  });

  powerMonitor.on('on-battery', () => {
    if (!config.events.battery) return;
    sendEvent('battery.changed', { charging: false });
  });

  powerMonitor.on('on-ac', () => {
    if (!config.events.battery) return;
    sendEvent('battery.changed', { charging: true });
  });

  startActiveAppCollector();
  startIdleCollector();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC ────────────────────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('config:get', (): Config => config);

ipcMain.handle('config:set', (_e, next: Config): void => {
  config = {
    ...DEFAULT_CONFIG,
    ...next,
    events:      { ...DEFAULT_CONFIG.events, ...next.events },
    blockedApps: Array.isArray(next.blockedApps) ? next.blockedApps : [],
  };
  saveConfig();
  lastActiveApp = null;
});

ipcMain.handle('status:get', (): Status => status);
