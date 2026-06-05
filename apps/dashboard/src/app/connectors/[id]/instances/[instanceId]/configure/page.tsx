'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  minLength?: number;
  default?: unknown;
  items?: { type: string };
}

interface JsonSchema {
  definitions?: Record<string, {
    type: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  }>;
}

interface ConnectorDetail {
  manifest: {
    id: string;
    name: string;
    description: string;
    type: string;
    version: string;
    authType: string;
    setupInstructions: string[];
  };
  configSchema: JsonSchema;
  secretsSchema: JsonSchema | null;
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

function getProperties(schema: JsonSchema | null) {
  if (!schema) return null;
  const def = schema.definitions ? Object.values(schema.definitions)[0] : null;
  return def?.properties ?? null;
}

function getRequired(schema: JsonSchema | null): string[] {
  if (!schema) return [];
  const def = schema.definitions ? Object.values(schema.definitions)[0] : null;
  return def?.required ?? [];
}

export default function InstanceConfigurePage() {
  const { id, instanceId } = useParams<{ id: string; instanceId: string }>();
  const router = useRouter();
  const isNew = instanceId === 'new';

  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [instanceName, setInstanceName] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [hasExistingSecrets, setHasExistingSecrets] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [ingestUrl, setIngestUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const backHref = isNew ? `/connectors/${id}` : `/connectors/${id}/instances/${instanceId}`;

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

      if (!isNew && status.workspaceId) {
        const res = await fetch(`${API}/connectors/${id}/instances/${instanceId}`, { cache: 'no-store' });
        if (res.ok) {
          const inst: InstanceConfig = await res.json();
          setInstanceName(inst.name ?? '');
          setEnabled(inst.enabled);
          setHasExistingSecrets(inst.hasSecrets);
          setWebhookUrl(inst.webhookUrl);
          setIngestUrl(inst.ingestUrl);
          setConfig(
            Object.fromEntries(
              Object.entries(inst.config).map(([k, v]) => [k, String(v)]),
            ),
          );
        }
      }
    }
    load();
  }, [id, instanceId, isNew]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setSaving(true);
    setError('');
    setSaved(false);

    const parsedConfig: Record<string, unknown> = {};
    const configProps = getProperties(detail?.configSchema ?? null);
    if (configProps) {
      for (const [key, prop] of Object.entries(configProps)) {
        const raw = config[key] ?? '';
        if (prop.type === 'array') {
          parsedConfig[key] = raw.split('\n').map((s) => s.trim()).filter(Boolean);
        } else if (prop.type === 'number' || prop.type === 'integer') {
          parsedConfig[key] = raw === '' ? undefined : Number(raw);
        } else if (prop.type === 'boolean') {
          parsedConfig[key] = raw === '' ? undefined : raw === 'true';
        } else {
          parsedConfig[key] = raw;
        }
      }
    }

    const hasNewSecrets = Object.values(secrets).some((v) => v.trim() !== '');

    try {
      let res: Response;
      if (isNew) {
        res = await fetch(`${API}/connectors/${id}/instances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            name: instanceName.trim() || undefined,
            enabled,
            config: parsedConfig,
            ...(hasNewSecrets ? { secrets } : {}),
          }),
        });
      } else {
        res = await fetch(`${API}/connectors/${id}/instances/${instanceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: instanceName.trim() || undefined,
            enabled,
            config: parsedConfig,
            ...(hasNewSecrets ? { secrets } : {}),
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Save failed');
      }

      const result: { id?: string; webhookUrl?: string | null; ingestUrl?: string | null } = await res.json();

      if (isNew) {
        router.push(`/connectors/${id}/instances/${result.id}`);
      } else {
        setWebhookUrl(result.webhookUrl ?? webhookUrl);
        setIngestUrl(result.ingestUrl ?? ingestUrl);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this instance? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/connectors/${id}/instances/${instanceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push(`/connectors/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (!detail) {
    return <div className="p-8 text-slate-500 text-sm">Loading…</div>;
  }

  const configProps = getProperties(detail.configSchema);
  const secretsProps = getProperties(detail.secretsSchema);
  const requiredSecrets = getRequired(detail.secretsSchema);

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href={backHref} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? `New ${detail.manifest.name} instance` : (instanceName || detail.manifest.name)}
        </h1>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {detail.manifest.type}
        </span>
      </div>

      {!workspaceId && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Complete <Link href="/setup" className="underline">workspace setup</Link> before configuring connectors.
        </div>
      )}

      {detail.manifest.setupInstructions.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5 mb-6">
          <h2 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Setup instructions</h2>
          <ol className="space-y-2">
            {detail.manifest.setupInstructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-blue-900">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-semibold flex-none mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="General">
          <Field label="Instance name" description="Optional label to tell this instance apart from others.">
            <input
              type="text"
              placeholder={`My ${detail.manifest.name}`}
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              className={input}
            />
          </Field>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-slate-700">Enabled</span>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </label>
        </Section>

        {detail.manifest.authType === 'apikey' && (ingestUrl || !isNew) && (
          <Section title="API Key Authentication">
            <p className="text-xs text-slate-500 mb-3">
              This connector authenticates via API key. Create a key for{' '}
              <strong>{detail.manifest.name}</strong> on the{' '}
              <a href="/api-keys" className="text-blue-600 hover:underline">API Keys page</a>,
              then include it in every request.
            </p>
            {ingestUrl && (
              <>
                <p className="text-xs font-medium text-slate-700 mb-1">Ingest endpoint</p>
                <code className="block text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded break-all mb-3">
                  POST {ingestUrl}
                </code>
                <p className="text-xs font-medium text-slate-700 mb-1">Authorization header</p>
                <code className="block text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded">
                  Authorization: Bearer {'<your-api-key>'}
                </code>
              </>
            )}
            {!ingestUrl && isNew && (
              <p className="text-xs text-slate-500">The ingest endpoint will be shown after saving.</p>
            )}
          </Section>
        )}

        {detail.manifest.authType !== 'apikey' && (detail.manifest.type === 'webhook' || detail.manifest.type === 'device') && webhookUrl && (
          <Section title={detail.manifest.type === 'device' ? 'Device Endpoint' : 'Webhook URL'}>
            <p className="text-xs text-slate-500 mb-2">
              {detail.manifest.type === 'device'
                ? 'Use this URL in your shell hook or local agent.'
                : `Point your ${detail.manifest.name} webhook at this URL.`}
            </p>
            <code className="block text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded break-all">
              {webhookUrl}
            </code>
          </Section>
        )}

        {detail.manifest.authType !== 'apikey' && (detail.manifest.type === 'webhook' || detail.manifest.type === 'device') && isNew && !webhookUrl && (
          <Section title={detail.manifest.type === 'device' ? 'Device Endpoint' : 'Webhook URL'}>
            <p className="text-xs text-slate-500">A unique endpoint URL will be generated after saving.</p>
          </Section>
        )}

        {configProps && Object.keys(configProps).length > 0 && (
          <Section title="Configuration">
            {Object.entries(configProps).map(([key, prop]) => (
              <Field key={key} label={key} description={prop.description}>
                {prop.type === 'array' ? (
                  <textarea
                    rows={3}
                    placeholder="One value per line"
                    value={config[key] ?? ''}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                    className={input}
                  />
                ) : (
                  <input
                    type="text"
                    value={config[key] ?? ''}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                    className={input}
                  />
                )}
              </Field>
            ))}
          </Section>
        )}

        {detail.manifest.authType === 'oauth2' && !isNew && (
          <Section title="Authorization">
            {hasExistingSecrets ? (
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
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Connect your account to allow Kairosis to fetch data on your behalf.
                </p>
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
          </Section>
        )}

        {detail.manifest.authType !== 'oauth2' && secretsProps && (
          <Section title="Secrets">
            <p className="text-xs text-slate-500 mb-3">
              {hasExistingSecrets
                ? 'Secrets are saved. Leave fields blank to keep existing values.'
                : 'Enter your secret credentials. These are encrypted at rest.'}
            </p>
            {Object.entries(secretsProps).map(([key, prop]) => (
              <Field
                key={key}
                label={key}
                description={prop.description}
                required={requiredSecrets.includes(key) && !hasExistingSecrets}
              >
                <input
                  type="password"
                  placeholder={hasExistingSecrets ? '••••••••' : ''}
                  value={secrets[key] ?? ''}
                  onChange={(e) => setSecrets((p) => ({ ...p, [key]: e.target.value }))}
                  className={input}
                />
              </Field>
            ))}
          </Section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved successfully.</p>}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !workspaceId}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
            <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Cancel
            </Link>
          </div>
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete instance'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

const input =
  'mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  description,
  required,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      {children}
    </div>
  );
}
