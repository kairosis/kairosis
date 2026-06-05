'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface ConnectorDetail {
  manifest: {
    id: string;
    name: string;
    type: string;
    version: string;
    authType: string;
    requiresAuth: boolean;
  };
}

interface InstanceConfig {
  id: string;
  name: string | null;
  enabled: boolean;
  hasSecrets: boolean;
  webhookUrl: string | null;
  ingestUrl: string | null;
  config: Record<string, unknown>;
}

interface ConnectorStats {
  total: number;
  lastEventAt: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(diff / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const TYPE_BADGE: Record<string, string> = {
  webhook: 'bg-blue-100 text-blue-700',
  poller:  'bg-purple-100 text-purple-700',
  device:  'bg-green-100 text-green-700',
  import:  'bg-orange-100 text-orange-700',
  sync:    'bg-teal-100 text-teal-700',
};

export default function InstanceDetailPage() {
  const { id, instanceId } = useParams<{ id: string; instanceId: string }>();
  const searchParams = useSearchParams();
  const oauthSuccess = searchParams.get('oauth_success') === '1';
  const oauthError   = searchParams.get('oauth_error');

  const [workspaceId, setWorkspaceId]   = useState<string | null>(null);
  const [detail, setDetail]             = useState<ConnectorDetail | null>(null);
  const [instance, setInstance]         = useState<InstanceConfig | null>(null);
  const [stats, setStats]               = useState<ConnectorStats | null>(null);

  const [toggling, setToggling]         = useState(false);
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      const [statusRes, detailRes] = await Promise.all([
        fetch(`${API}/setup/status`, { cache: 'no-store' }),
        fetch(`${API}/connectors/${id}`, { cache: 'no-store' }),
      ]);
      const status = await statusRes.json();
      const det: ConnectorDetail = await detailRes.json();
      setWorkspaceId(status.workspaceId);
      setDetail(det);

      if (!status.workspaceId) return;

      const [instRes, statsRes] = await Promise.all([
        fetch(`${API}/connectors/${id}/instances/${instanceId}`, { cache: 'no-store' }),
        fetch(`${API}/events/stats?workspaceId=${status.workspaceId}&connectorId=${id}`, { cache: 'no-store' }),
      ]);

      if (instRes.ok)   setInstance(await instRes.json());
      if (statsRes.ok)  setStats(await statsRes.json());
    }
    load();
  }, [id, instanceId]);

  async function handleToggle() {
    if (!instance || !workspaceId) return;
    setToggling(true);
    try {
      const res = await fetch(`${API}/connectors/${id}/instances/${instanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    instance.name ?? undefined,
          enabled: !instance.enabled,
          config:  instance.config,
        }),
      });
      if (res.ok) setInstance((prev) => prev ? { ...prev, enabled: !prev.enabled } : prev);
    } finally {
      setToggling(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/connectors/${id}/instances/${instanceId}/test`, { method: 'POST' });
      const data: { ok: boolean; message: string } = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'Could not reach the API.' });
    } finally {
      setTesting(false);
    }
  }

  if (!detail || !instance) {
    return <div className="p-8 text-slate-500 text-sm">Loading…</div>;
  }

  const displayName = instance.name || `${detail.manifest.name} instance`;
  const typeBadge   = TYPE_BADGE[detail.manifest.type] ?? 'bg-slate-100 text-slate-500';

  return (
    <div className="p-8 max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/connectors/${id}`} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
            {detail.manifest.type}
          </span>
        </div>
        <div className="flex items-center justify-between ml-7">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                instance.enabled
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${instance.enabled ? 'bg-green-500' : 'bg-slate-400'}`} />
              {instance.enabled ? 'Enabled' : 'Disabled'}
            </button>
            <span className="text-xs text-slate-400">v{detail.manifest.version}</span>
          </div>
          <Link
            href={`/connectors/${id}/instances/${instanceId}/configure`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Link>
        </div>
      </div>

      {/* OAuth2 feedback banners */}
      {oauthSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <svg className="w-4 h-4 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Account connected successfully.
        </div>
      )}
      {oauthError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <svg className="w-4 h-4 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Authorization failed: {oauthError}.{' '}
          <a
            href={`${API}/oauth2/connect/${id}?workspaceId=${workspaceId}&instanceId=${instanceId}`}
            className="underline hover:text-red-900"
          >
            Try again
          </a>
        </div>
      )}

      {/* OAuth2 authorization */}
      {detail.manifest.authType === 'oauth2' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Authorization</h2>
          {instance.hasSecrets ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Account connected
              </div>
              <a
                href={`${API}/oauth2/connect/${id}?workspaceId=${workspaceId}&instanceId=${instanceId}`}
                className="text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
              >
                Re-authorize
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">No account connected yet.</p>
              <a
                href={`${API}/oauth2/connect/${id}?workspaceId=${workspaceId}&instanceId=${instanceId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Authorize
              </a>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Last event received</p>
          {stats?.lastEventAt ? (
            <>
              <p className="text-lg font-semibold text-slate-900">{timeAgo(stats.lastEventAt)}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(stats.lastEventAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-slate-400">No events yet</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total events produced</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</p>
        </div>
      </div>

      {/* Endpoint */}
      {(instance.webhookUrl || instance.ingestUrl) && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {detail.manifest.authType === 'apikey' ? 'Ingest Endpoint' : (detail.manifest.type === 'webhook' ? 'Webhook URL' : 'Device Endpoint')}
          </h2>
          <code className="block text-xs bg-slate-50 text-slate-700 px-3 py-2 rounded border border-slate-100 break-all">
            {instance.ingestUrl
              ? `POST ${instance.ingestUrl}`
              : instance.webhookUrl}
          </code>
          {detail.manifest.authType === 'apikey' && (
            <p className="text-xs text-slate-400 mt-2">
              Include <code className="bg-slate-100 px-1 rounded">Authorization: Bearer &lt;key&gt;</code> — manage keys on the{' '}
              <Link href="/api-keys" className="text-blue-600 hover:underline">API Keys page</Link>.
            </p>
          )}
        </div>
      )}

      {/* Config overview */}
      {Object.keys(instance.config).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Configuration</h2>
            <Link
              href={`/connectors/${id}/instances/${instanceId}/configure`}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              Edit →
            </Link>
          </div>
          <dl className="space-y-2">
            {Object.entries(instance.config).map(([key, value]) => {
              const display = Array.isArray(value)
                ? (value as string[]).join(', ') || '—'
                : String(value ?? '—');
              return (
                <div key={key} className="flex gap-4 text-sm">
                  <dt className="w-40 flex-none text-slate-500 truncate">{key}</dt>
                  <dd className="text-slate-900 truncate flex-1">{display || '—'}</dd>
                </div>
              );
            })}
          </dl>
          {instance.hasSecrets && (
            <p className="mt-3 text-xs text-slate-400">Secrets are saved and encrypted.</p>
          )}
        </div>
      )}

      {/* Test */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Test connector</h2>
        <p className="text-sm text-slate-500 mb-4">
          Verify that this instance is active and properly configured.
        </p>
        {testResult && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            testResult.ok
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {testResult.message}
          </div>
        )}
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          {testing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Testing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Test connector
            </>
          )}
        </button>
      </div>

    </div>
  );
}
