const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface ConnectorManifest {
  id: string;
  name: string;
  description: string;
  type: 'webhook' | 'poller' | 'device' | 'import' | 'sync';
  version: string;
  author: string;
  triggers: string[];
  requiresAuth: boolean;
}

const TYPE_BADGE: Record<string, string> = {
  webhook: 'bg-blue-100 text-blue-700',
  poller:  'bg-purple-100 text-purple-700',
  device:  'bg-green-100 text-green-700',
  import:  'bg-orange-100 text-orange-700',
  sync:    'bg-teal-100 text-teal-700',
};

async function getConnectors(): Promise<ConnectorManifest[]> {
  try {
    const res = await fetch(`${API}/connectors`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ConnectorsPage() {
  const connectors = await getConnectors();

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Connectors</h1>
      <p className="text-slate-500 mb-8 text-sm">
        Available connectors for your workspace. Enable and configure each one to start collecting events.
      </p>

      {connectors.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No connectors found. Make sure the API is running.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connectors.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorCard({ connector: c }: { connector: ConnectorManifest }) {
  const badge = TYPE_BADGE[c.type] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm">{c.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5 leading-snug">{c.description}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-none ${badge}`}>
          {c.type}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {c.triggers.slice(0, 3).map((t) => (
          <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
            {t}
          </span>
        ))}
        {c.triggers.length > 3 && (
          <span className="text-xs text-slate-400 self-center">+{c.triggers.length - 3} more</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">v{c.version}</span>
        <a
          href={`/connectors/${c.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          Configure →
        </a>
      </div>
    </div>
  );
}
