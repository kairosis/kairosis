'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface ConnectorDetail {
  manifest: {
    id: string;
    name: string;
    description: string;
    type: string;
    version: string;
    setupInstructions: string[];
  };
}

interface ConnectorInstance {
  id: string;
  name: string | null;
  enabled: boolean;
  hasSecrets: boolean;
  webhookUrl: string | null;
}

export default function ConnectorInstancesPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [instances, setInstances] = useState<ConnectorInstance[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statusRes, detailRes] = await Promise.all([
        fetch(`${API}/setup/status`, { cache: 'no-store' }),
        fetch(`${API}/connectors/${id}`, { cache: 'no-store' }),
      ]);

      const status = await statusRes.json();
      const det: ConnectorDetail = await detailRes.json();

      setDetail(det);
      setWorkspaceId(status.workspaceId);

      if (status.workspaceId) {
        const res = await fetch(
          `${API}/connectors/${id}/instances?workspaceId=${status.workspaceId}`,
          { cache: 'no-store' },
        );
        const list: ConnectorInstance[] = await res.json();
        setInstances(list);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading || !detail) {
    return <div className="p-8 text-slate-500 text-sm">Loading…</div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/connectors" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{detail.manifest.name}</h1>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {detail.manifest.type}
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-8 ml-7">v{detail.manifest.version}</p>

      {!workspaceId && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Complete <Link href="/setup" className="underline">workspace setup</Link> before configuring connectors.
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">
          Instances
          {instances.length > 0 && (
            <span className="ml-2 text-slate-400 font-normal">({instances.length})</span>
          )}
        </h2>
        {workspaceId && (
          <Link
            href={`/connectors/${id}/instances/new/configure`}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add instance
          </Link>
        )}
      </div>

      {instances.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-500 text-sm mb-1">No instances configured yet.</p>
          {workspaceId && (
            <p className="text-slate-400 text-xs">
              Click <span className="font-medium">+ Add instance</span> to create your first one.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((inst, i) => (
            <InstanceRow
              key={inst.id}
              instance={inst}
              fallbackName={`${detail.manifest.name} ${i + 1}`}
              connectorId={id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InstanceRow({
  instance: inst,
  fallbackName,
  connectorId,
}: {
  instance: ConnectorInstance;
  fallbackName: string;
  connectorId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 text-sm truncate">
            {inst.name ?? fallbackName}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              inst.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {inst.enabled ? 'enabled' : 'disabled'}
          </span>
        </div>
        {inst.webhookUrl && (
          <code className="mt-1 block text-xs text-slate-400 truncate max-w-sm">
            {inst.webhookUrl}
          </code>
        )}
      </div>
      <Link
        href={`/connectors/${connectorId}/instances/${inst.id}`}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
      >
        Configure →
      </Link>
    </div>
  );
}
