'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3200';

interface NormalizedEvent {
  id: string;
  type: string;
  routingKey?: string;
  workspaceId: string;
  connectorId: string;
  occurredAt: string;
  ingestedAt: string;
  actor?: { id: string; type: string; displayName?: string };
  subject?: { id: string; type: string; displayName?: string; url?: string };
  payload: Record<string, unknown>;
}

export default function EventsPage() {
  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API}/setup/status`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((s) => setWorkspaceId(s.workspaceId ?? null))
      .catch(() => {});
  }, []);

  // load historical events once workspaceId is available
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`${API}/events?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((rows: NormalizedEvent[]) => {
        rows.forEach((e) => seenIds.current.add(e.id));
        setEvents(rows);
      })
      .catch(() => {});
  }, [workspaceId]);

  // live SSE stream
  useEffect(() => {
    if (!workspaceId) return;

    const es = new EventSource(`${API}/events/stream?workspaceId=${workspaceId}`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.__heartbeat__) return;
        const event = parsed as NormalizedEvent;
        if (!event.id || seenIds.current.has(event.id)) return;
        seenIds.current.add(event.id);
        setEvents((prev) => [event, ...prev].slice(0, 500));
      } catch { /* skip */ }
    };
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, [workspaceId]);

  return (
    <div className="p-8 max-w-5xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Events</h1>
          <p className="text-slate-500 text-sm">Live stream and history of normalized events from all connectors.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            {connected ? 'Live' : 'Connecting…'}
          </span>
          {events.length > 0 && (
            <button
              onClick={() => { setEvents([]); seenIds.current.clear(); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!workspaceId && (
        <div className="text-sm text-slate-500 text-center py-16">
          No workspace found. <a href="/setup" className="underline text-blue-600">Complete setup</a> first.
        </div>
      )}

      {workspaceId && events.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">No events yet</p>
          <p className="text-xs mt-1">Trigger a webhook or action in a connected service.</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-2 overflow-y-auto flex-1">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: NormalizedEvent }) {
  const [expanded, setExpanded] = useState(false);
  const routingKey = event.routingKey ?? event.type;
  const occurredAt = new Date(event.occurredAt);
  const timestamp = isNaN(occurredAt.getTime())
    ? '—'
    : occurredAt.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white overflow-hidden cursor-pointer hover:border-slate-300 transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded whitespace-nowrap">
          {event.type}
        </span>
        <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded whitespace-nowrap hidden sm:inline">
          {routingKey}
        </span>
        {event.subject?.displayName && (
          <span className="text-sm text-slate-700 truncate flex-1">{event.subject.displayName}</span>
        )}
        {event.actor?.displayName && (
          <span className="text-xs text-slate-400 flex-none">{event.actor.displayName}</span>
        )}
        <span className="text-xs text-slate-400 flex-none ml-auto tabular-nums">{timestamp}</span>
        <svg
          className={`w-4 h-4 text-slate-300 flex-none transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-2">
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span><span className="font-medium text-slate-700">connector</span> {event.connectorId}</span>
            <span><span className="font-medium text-slate-700">routing key</span> {routingKey}</span>
            <span><span className="font-medium text-slate-700">occurred</span> {new Date(event.occurredAt).toISOString()}</span>
            <span><span className="font-medium text-slate-700">ingested</span> {new Date(event.ingestedAt).toISOString()}</span>
          </div>
          <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify({ actor: event.actor, subject: event.subject, payload: event.payload }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
