'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface ApiKeyMeta {
  id: string;
  workspaceId: string;
  connectorId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface ConnectorManifest {
  id: string;
  name: string;
  type: string;
  authType: string;
}

interface CreatedKey {
  id: string;
  key: string;
  keyPrefix: string;
  connectorId: string;
  name: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [connectors, setConnectors] = useState<ConnectorManifest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/setup/status`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((s) => setWorkspaceId(s.workspaceId ?? null))
      .catch(() => {});

    fetch(`${API}/connectors`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((list: ConnectorManifest[]) => setConnectors(list.filter((c) => c.authType === 'apikey')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`${API}/api-keys?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((list: ApiKeyMeta[]) => setKeys(list))
      .catch(() => {});
  }, [workspaceId]);

  function handleCreated(created: CreatedKey) {
    setNewKey(created);
    setShowForm(false);
    setKeys((prev) => [
      {
        id: created.id,
        workspaceId: workspaceId!,
        connectorId: created.connectorId,
        name: created.name,
        keyPrefix: created.keyPrefix,
        createdAt: created.createdAt,
        lastUsedAt: null,
        revokedAt: null,
      },
      ...prev,
    ]);
  }

  async function handleRevoke(id: string) {
    if (!workspaceId) return;
    setRevoking(id);
    try {
      await fetch(`${API}/api-keys/${id}?workspaceId=${workspaceId}`, { method: 'DELETE' });
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      );
    } finally {
      setRevoking(null);
    }
  }

  function handleCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">API Keys</h1>
          <p className="text-slate-500 text-sm">
            Keys for local agents and device connectors that push events directly to Kairosis.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setNewKey(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New API Key
          </button>
        )}
      </div>

      {!workspaceId && (
        <div className="text-sm text-slate-500 text-center py-16">
          No workspace found. <a href="/setup" className="underline text-blue-600">Complete setup</a> first.
        </div>
      )}

      {workspaceId && (
        <div className="space-y-6">
          {showForm && (
            <CreateKeyForm
              workspaceId={workspaceId}
              connectors={connectors}
              onCreated={handleCreated}
              onCancel={() => setShowForm(false)}
            />
          )}

          {newKey && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3 mb-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-green-800 font-medium text-sm">API key created — copy it now</p>
                  <p className="text-green-700 text-xs mt-0.5">
                    This is the only time this key will be shown. Store it somewhere safe.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm bg-white border border-green-200 rounded px-3 py-2 text-slate-800 break-all">
                  {newKey.key}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-none px-3 py-2 bg-green-700 text-white text-xs font-medium rounded hover:bg-green-800 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 text-xs text-green-700 hover:text-green-800 underline"
              >
                I've saved the key, dismiss
              </button>
            </div>
          )}

          {active.length === 0 && !showForm && !newKey && (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
              <p className="text-slate-500 text-sm">No active API keys. Create one to get started.</p>
            </div>
          )}

          {active.length > 0 && (
            <KeyTable
              title="Active"
              keys={active}
              connectors={connectors}
              revoking={revoking}
              onRevoke={handleRevoke}
              showRevoke
            />
          )}

          {revoked.length > 0 && (
            <KeyTable
              title="Revoked"
              keys={revoked}
              connectors={connectors}
              revoking={null}
              onRevoke={() => {}}
              showRevoke={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CreateKeyForm({
  workspaceId,
  connectors,
  onCreated,
  onCancel,
}: {
  workspaceId: string;
  connectors: ConnectorManifest[];
  onCreated: (key: CreatedKey) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [connectorId, setConnectorId] = useState(connectors[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !connectorId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, connectorId, name: name.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: CreatedKey = await res.json();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">New API Key</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My MacBook Agent"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Connector</label>
          <select
            value={connectorId}
            onChange={(e) => setConnectorId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          >
            {connectors.length === 0 && (
              <option value="">No connectors available</option>
            )}
            {connectors.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !connectorId}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Creating…' : 'Create key'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function KeyTable({
  title,
  keys,
  connectors,
  revoking,
  onRevoke,
  showRevoke,
}: {
  title: string;
  keys: ApiKeyMeta[];
  connectors: ConnectorManifest[];
  revoking: string | null;
  onRevoke: (id: string) => void;
  showRevoke: boolean;
}) {
  const connectorMap = Object.fromEntries(connectors.map((c) => [c.id, c.name]));

  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-slate-900">{k.name}</p>
              <p className="text-xs text-slate-400">
                {connectorMap[k.connectorId] ?? k.connectorId}
              </p>
            </div>

            <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded flex-none">
              {k.keyPrefix}…
            </code>

            <div className="text-right flex-none space-y-0.5">
              <p className="text-xs text-slate-500">{formatDate(k.createdAt)}</p>
              <p className="text-xs text-slate-400">
                {k.lastUsedAt ? `Used ${formatDate(k.lastUsedAt)}` : 'Never used'}
              </p>
            </div>

            {showRevoke && (
              <button
                onClick={() => onRevoke(k.id)}
                disabled={revoking === k.id}
                className="flex-none text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
              >
                {revoking === k.id ? 'Revoking…' : 'Revoke'}
              </button>
            )}

            {!showRevoke && k.revokedAt && (
              <span className="flex-none text-xs text-slate-400">{formatDate(k.revokedAt)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
