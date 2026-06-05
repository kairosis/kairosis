import { useCallback, useEffect, useRef, useState } from 'react';

// ── Styles ─────────────────────────────────────────────────────────────────────

const c = {
  root: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 13,
    color: '#1d1d1f',
    background: '#f5f5f7',
    height: '100vh',
    overflowY: 'auto' as const,
    paddingBottom: 24,
  },
  header: {
    paddingTop: 48,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 16,
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
    margin: 0,
    letterSpacing: '-0.2px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    fontSize: 12,
    color: '#6e6e73',
  },
  dot: (connected: boolean | null) => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: connected === null ? '#aeaeb2' : connected ? '#30d158' : '#ff453a',
    flexShrink: 0,
  }),
  section: {
    margin: '8px 0 0',
    padding: '0 20px',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6e6e73',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    overflow: 'hidden' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  field: {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  fieldLast: {
    padding: '10px 14px',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#6e6e73',
    marginBottom: 3,
  },
  input: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 13,
    background: 'transparent',
    color: '#1d1d1f',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 14px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  rowLast: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 14px',
  },
  rowLabel: {
    fontSize: 13,
    color: '#1d1d1f',
  },
  saveRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '10px 14px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  btn: {
    padding: '5px 14px',
    borderRadius: 6,
    border: 'none',
    background: '#0071e3',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSm: {
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    background: '#0071e3',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  addRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  addInput: {
    flex: 1,
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fafafa',
  },
  appItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  appItemLast: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#ff453a',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    fontFamily: 'inherit',
  },
  empty: {
    padding: '12px 14px',
    color: '#aeaeb2',
    fontSize: 12,
    textAlign: 'center' as const,
  },
};

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: on ? '#30d158' : '#d1d1d6',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  apiEndpoint: 'http://localhost:3200',
  apiKey:      '',
  events:      { activeApp: true, screenLock: true, idle: true, battery: true },
  blockedApps: [],
};

export function App() {
  const [cfg, setCfg]         = useState<Config>(DEFAULT_CONFIG);
  const [status, setStatus]   = useState<Status>({ connected: null, lastAt: null, error: null });
  const [saved, setSaved]     = useState(false);
  const [newApp, setNewApp]   = useState('');
  const newAppRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.kairosis.getConfig().then(setCfg);
    window.kairosis.getStatus().then(setStatus);
    const t = setInterval(() => window.kairosis.getStatus().then(setStatus), 5_000);
    return () => clearInterval(t);
  }, []);

  const save = useCallback(async () => {
    await window.kairosis.setConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [cfg]);

  const addApp = useCallback(() => {
    const name = newApp.trim();
    if (!name || cfg.blockedApps.some((a) => a.toLowerCase() === name.toLowerCase())) return;
    setCfg((prev) => ({ ...prev, blockedApps: [...prev.blockedApps, name] }));
    setNewApp('');
    newAppRef.current?.focus();
  }, [newApp, cfg.blockedApps]);

  const removeApp = useCallback((app: string) => {
    setCfg((prev) => ({ ...prev, blockedApps: prev.blockedApps.filter((a) => a !== app) }));
  }, []);

  const setEvent = useCallback((key: keyof Config['events'], val: boolean) => {
    setCfg((prev) => ({ ...prev, events: { ...prev.events, [key]: val } }));
  }, []);

  const statusLabel =
    status.connected === null ? 'Not configured'
    : status.connected        ? `Connected · ${formatAgo(status.lastAt)}`
    :                           `Error · ${status.error ?? 'unknown'}`;

  return (
    <div style={c.root}>
      {/* Header */}
      <div style={c.header}>
        <h1 style={c.title}>Kairosis</h1>
        <div style={c.statusRow}>
          <span style={c.dot(status.connected)} />
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Connection */}
      <div style={c.section}>
        <p style={c.sectionLabel}>Connection</p>
        <div style={c.card}>
          <div style={c.field}>
            <p style={c.fieldLabel}>API Endpoint</p>
            <input
              style={c.input}
              value={cfg.apiEndpoint}
              onChange={(e) => setCfg((p) => ({ ...p, apiEndpoint: e.target.value }))}
              placeholder="http://localhost:3200"
              spellCheck={false}
            />
          </div>
          <div style={c.fieldLast}>
            <p style={c.fieldLabel}>API Key</p>
            <input
              style={c.input}
              type="password"
              value={cfg.apiKey}
              onChange={(e) => setCfg((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="Bearer key from API Keys page"
              spellCheck={false}
            />
          </div>
          <div style={c.saveRow}>
            <button style={c.btn} onClick={save}>
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Events */}
      <div style={{ ...c.section, marginTop: 16 }}>
        <p style={c.sectionLabel}>Events</p>
        <div style={c.card}>
          {(
            [
              ['activeApp',  'Active App'],
              ['screenLock', 'Screen Lock / Unlock'],
              ['idle',       'Idle Detection'],
              ['battery',    'Battery Status'],
            ] as [keyof Config['events'], string][]
          ).map(([key, label], i, arr) => (
            <div key={key} style={i < arr.length - 1 ? c.row : c.rowLast}>
              <span style={c.rowLabel}>{label}</span>
              <Toggle on={cfg.events[key]} onChange={(v) => setEvent(key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* Blocked Apps */}
      <div style={{ ...c.section, marginTop: 16 }}>
        <p style={c.sectionLabel}>Blocked Apps</p>
        <div style={c.card}>
          <div style={c.addRow}>
            <input
              ref={newAppRef}
              style={c.addInput}
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addApp()}
              placeholder="App name, e.g. Slack"
            />
            <button style={c.btnSm} onClick={addApp}>Add</button>
          </div>
          {cfg.blockedApps.length === 0 ? (
            <p style={c.empty}>No blocked apps</p>
          ) : (
            cfg.blockedApps.map((app, i) => (
              <div key={app} style={i < cfg.blockedApps.length - 1 ? c.appItem : c.appItemLast}>
                <span>{app}</span>
                <button style={c.removeBtn} onClick={() => removeApp(app)} title="Remove">✕</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
