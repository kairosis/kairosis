const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface SetupStatus {
  setupComplete:       boolean;
  workspaceId:         string | null;
  hasActiveConnectors: boolean;
  activeInstanceCount: number;
}

async function getSetupStatus(): Promise<SetupStatus> {
  try {
    const res = await fetch(`${API}/setup/status`, { cache: 'no-store' });
    if (!res.ok) return { setupComplete: false, workspaceId: null, hasActiveConnectors: false, activeInstanceCount: 0 };
    return res.json();
  } catch {
    return { setupComplete: false, workspaceId: null, hasActiveConnectors: false, activeInstanceCount: 0 };
  }
}

async function getConnectors(): Promise<unknown[]> {
  try {
    const res = await fetch(`${API}/connectors`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getEventsTodayCount(workspaceId: string): Promise<number> {
  try {
    const res = await fetch(`${API}/events/count-today?workspaceId=${workspaceId}`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const data: { count: number } = await res.json();
    return data.count;
  } catch {
    return 0;
  }
}

export default async function DashboardPage() {
  const [status, connectors] = await Promise.all([getSetupStatus(), getConnectors()]);
  const eventsToday = status.workspaceId ? await getEventsTodayCount(status.workspaceId) : 0;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h1>
      <p className="text-slate-500 mb-8 text-sm">Overview of your Kairosis instance.</p>

      {!status.setupComplete && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-amber-800 font-medium text-sm">Setup required</p>
            <p className="text-amber-700 text-sm mt-0.5">Create your workspace to start collecting events.</p>
            <a href="/setup" className="mt-2 inline-block text-sm font-medium text-amber-800 underline">
              Go to setup →
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Connector types" value={connectors.length} />
        <StatCard label="Active instances" value={status.activeInstanceCount} />
        <StatCard label="Events today" value={eventsToday} />
      </div>

      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Getting started
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        <Step n={1} done={status.setupComplete}       label="Create a workspace"      href="/setup" />
        <Step n={2} done={status.hasActiveConnectors} label="Configure a connector"   href="/connectors" />
        <Step n={3} done={status.hasActiveConnectors} label="Receive your first event" href="/events" />
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
      {note && <p className="text-xs text-slate-400 mt-1">{note}</p>}
    </div>
  );
}

function Step({ n, done, label, href }: { n: number; done: boolean; label: string; href: string }) {
  return (
    <a href={href} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold flex-none ${
        done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {done ? '✓' : n}
      </span>
      <span className={`text-sm font-medium flex-1 ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
        {label}
      </span>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}
