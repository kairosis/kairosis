# Kairosis — Claude Context

This file gives Claude Code the context needed to work effectively in this
repository. Read it fully before making any changes.

---

## What Kairosis is

Kairosis is a self-hosted event collection and normalization platform. It
connects to external tools via webhooks, polling, local agents, and device
integrations — normalizes every signal into a common `NormalizedEvent`
envelope — and publishes it to a RabbitMQ topic exchange.

Kairosis does not store knowledge, build graphs, or process events beyond
normalization. That is downstream consumers' responsibility.

**One job: collect, normalize, publish.**

---

## Repository structure

```
kairosis/
  apps/
    api/                NestJS REST API + webhook receiver (port 3200)
    dashboard/          Next.js connector management UI (port 3001)
    poller-worker/      NestJS standalone context — scheduled polling
  connectors/           internal connector implementations — never published
    github/             GitHub webhook connector (push, PR, issues)
  events/               published to npm — @kairosis/* event packages
    core/               → @kairosis/events-core
    events/             → @kairosis/events (re-exports all)
    github/             → @kairosis/github-events
    slack/              → @kairosis/slack-events
    email/              → @kairosis/email-events
    calendar/           → @kairosis/calendar-events
    browser/            → @kairosis/browser-events
    terminal/           → @kairosis/terminal-events
    health/             → @kairosis/health-events
    location/           → @kairosis/location-events
    obsidian/           → @kairosis/obsidian-events
    notion/             → @kairosis/notion-events
    synthesized/        → @kairosis/synthesized-events
  packages/             published to npm — tooling for connector authors
    connector-sdk/      → @kairosis/connector-sdk
  libs/                 internal only — never published
    connectors/         connector interface, registry, manifest schema
    connector-config/   TypeORM entities + ConnectorConfigService
    crypto/             AES-256-GCM CryptoService
    messaging/          RabbitMQ publisher + SSE consumer stream
    tenant/             TenantContext (AsyncLocalStorage)
    ui/                 shared React components (stub)
```

### Folder meaning

```
apps/           processes — deployed as Docker containers
connectors/     internal connector implementations — not published, imported by apps
events/         published npm packages — shared event contracts
packages/       published npm packages — connector authoring tooling
libs/           internal shared code — not published, never imported externally
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 (Nx 21 monorepo) |
| Dashboard | React 19 · Next.js 15 (App Router) · Tailwind CSS |
| Message broker | RabbitMQ (AMQP) — topic exchange `kairosis.topic` |
| Operational data | PostgreSQL 16 (TypeORM, `synchronize: true` in dev) |
| Validation | Zod throughout — no exceptions |
| Schema → UI | zod-to-json-schema (connector config forms) |
| Encryption | AES-256-GCM (Node.js crypto) |
| Mobile | Flutter (watch + location — not yet built) |
| npm scope | @kairosis |

---

## Core architectural rules

### 1. Zod validates everything
Every NormalizedEvent, every connector config, every secrets object, every
payload — validated by Zod before anything is stored or published.

```typescript
// always validate before publishing
const event = NormalizedEventSchema.parse(raw);
await publisher.publish(event);
```

### 2. TenantContext flows through everything
WorkspaceId is never passed as a function parameter through service layers.
It lives in AsyncLocalStorage and is accessed via TenantContext.

```typescript
// correct
const workspaceId = TenantContext.getWorkspaceId();

// never do this
async function doThing(workspaceId: string) { ... }
```

Set TenantContext at the HTTP boundary (guard) or at the poller entry point.
Never set it inside a service.

Exception: connector `normalize(body, workspaceId, config)` receives workspaceId
as a direct parameter — connectors are plugin-boundary code, not service layers.

### 3. Config and secrets are always separate
Every connector has two Zod schemas — never merge them:

```typescript
configSchema()   → non-sensitive, stored as JSONB, shown in UI
secretsSchema()  → sensitive, encrypted AES-256-GCM, stored as BYTEA
```

Secrets are never returned via API. Only `hasSecrets: boolean` is exposed.

### 4. Webhook URLs never contain workspaceId
Use opaque webhook tokens instead:

```
POST /webhooks/:connectorId/:webhookToken
```

The token maps to a workspace internally. WorkspaceId is never in the URL.

### 5. Verify before normalize
Webhook connectors must verify the payload signature before normalizing.
Never call normalize() on an unverified payload.

```typescript
const valid = await connector.verifyWebhook({ body, headers, rawBody, secrets });
if (!valid) throw new UnauthorizedException();
const events = await connector.normalize(body, workspaceId, config);
```

### 6. rawBody required for HMAC verification
The API is created with `{ rawBody: true }` in `main.ts`. Access via `req.rawBody`.
Most HMAC schemes (Slack, GitHub) require the exact raw bytes.

### 7. RabbitMQ down → crash the app
If RabbitMQ is unavailable on startup, the app crashes.
Docker restart policy handles recovery.
Do not add reconnection logic or silent failure handling.

### 8. NormalizedEvent is the only output
Connectors produce NormalizedEvent[]. Nothing else leaves a connector.
No direct database writes. No side effects. Just events.

### 9. Event packages are the shared contract
All event types, payload schemas, and the NormalizedEvent envelope live
in `events/`. These are published to npm and depended on by downstream
consumers. Breaking changes require a major version bump.

Never define event types or payload schemas outside of `events/`.

---

## Connector architecture

### Interface

```typescript
export interface IKairosisConnector {
  manifest:      ConnectorManifest;
  configSchema(): ZodSchema;
  secretsSchema?(): ZodSchema;
  onInit?(config: unknown): Promise<void>;
  onDestroy?(): Promise<void>;
}
```

### Types

```
WebhookConnector    HTTP POST from external service
                    implements verifyWebhook() + normalize()

PollerConnector     fetches on configurable cron
                    implements poll(config, workspaceId) → NormalizedEvent[]

DeviceConnector     push from local device/app
                    implements normalize()

ImportConnector     bulk one-time or periodic import
                    implements import() as AsyncGenerator<NormalizedEvent[]>

SyncConnector       bidirectional — import + export + live sync
                    implements import() + export() + sync?()
```

### Manifest

```typescript
export const ConnectorManifestSchema = z.object({
  id:                z.string().regex(/^[a-z0-9-]+$/),  // kebab-case
  name:              z.string(),
  description:       z.string(),
  version:           z.string(),                          // semver
  author:            z.string(),
  type:              z.enum(['webhook', 'poller', 'device', 'import', 'sync']),
  triggers:          z.array(z.string()),                 // routing keys emitted
  requiresAuth:      z.boolean().default(false),
  authType:          z.enum(['oauth2', 'apikey', 'basic', 'none']).default('none'),
  setupInstructions: z.array(z.string()).default([]),     // shown in configure UI
});
```

`setupInstructions` is an ordered list of steps shown on the connector configure
page. Keep each step short and actionable.

### Registering a connector

Connectors are registered in `apps/api/src/connectors/connectors.module.ts`
via `ConnectorRegistry.register()` in `onModuleInit`. Add new connectors there.

---

## Event package structure

Each event package in `events/` follows this pattern:

```
events/github/
  src/
    event-types.ts        GithubEventType constants
    payloads/
      commit-pushed.ts    GithubCommitPushedPayload (Zod schema + type)
      pr-opened.ts
      pr-merged.ts
      issue.ts
      ...
    index.ts              barrel export
  package.json            name: @kairosis/github-events
  tsconfig.json
```

### Naming conventions for event packages

```typescript
// event type constants
export const GithubEventType = {
  COMMIT_PUSHED: 'github.commit.pushed',
  PR_OPENED:     'github.pr.opened',
  // ...
} as const;

// payload schemas — PascalCase + Payload suffix
export const GithubCommitPushedPayload = z.object({ ... });

// inferred types
export type GithubCommitPushed = z.infer<typeof GithubCommitPushedPayload>;
```

### events-core exports

```typescript
// @kairosis/events-core
NormalizedEventSchema    // Zod schema
NormalizedEvent          // inferred type
ActorSchema
SubjectSchema
RoutingKey               // routing key constants and builders
```

---

## API endpoints (apps/api)

```
GET  /setup/status                → { setupComplete, workspaceId, hasActiveConnectors }
POST /setup                       → { workspaceId }  body: { workspaceName }

GET  /connectors                  → ConnectorManifest[]
GET  /connectors/:id              → { manifest, configSchema, secretsSchema }
GET  /connectors/:id/config       → { enabled, hasSecrets, webhookUrl, config }
                                    query: workspaceId
POST /connectors/:id/configure    → { ok, webhookUrl }
                                    body: { workspaceId, enabled, config, secrets? }

POST /webhooks/:connectorId/:webhookToken  → { ok, published }

GET  /events/stream               → SSE stream of NormalizedEvent
                                    query: workspaceId
```

Webhook URL format: `{API_PUBLIC_URL}/webhooks/{connectorId}/{webhookToken}`
`API_PUBLIC_URL` env var controls the public-facing host (default: http://localhost:3200).

---

## Connector config storage

```sql
CREATE TABLE connector_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  connector_id  TEXT NOT NULL,
  enabled       BOOLEAN DEFAULT false,
  config        JSONB NOT NULL DEFAULT '{}',   -- plaintext
  secrets       BYTEA,                         -- AES-256-GCM encrypted
  webhook_token TEXT UNIQUE,                   -- for webhook connectors
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, connector_id)
);
```

### Encryption

```
Algorithm:  AES-256-GCM
Key:        ENCRYPTION_KEY env var — 32-byte hex string
            generate: openssl rand -hex 32
Storage:    IV (12 bytes) + Auth tag (16 bytes) + Ciphertext — concatenated as BYTEA
```

Never log secrets. Never return secrets via API. Never store secrets as JSONB.

---

## RabbitMQ

```
Exchange:     kairosis.topic (topic type)
Routing keys: match event type exactly — 'email.received', 'github.pr.merged'
              dot notation enables wildcard subscriptions

Patterns:
  email.#           all email events
  github.pr.#       all GitHub PR events
  health.#          all health events
  #                 everything
```

Publish after validation — never publish an unvalidated event.

The SSE stream (`GET /events/stream`) creates a per-connection exclusive
auto-delete queue bound to `kairosis.topic` with `#`, filtered by workspaceId.

---

## Webhook flow

```
POST /webhooks/:connectorId/:webhookToken
  → look up workspace from webhookToken (ConnectorConfigService)
  → load connector config + secrets (decrypt with CryptoService)
  → connector.verifyWebhook() — HMAC or signature check
  → if invalid → 401, log, stop
  → TenantContext.run({ workspaceId })
  → connector.normalize(body, workspaceId, config) → NormalizedEvent[]
  → NormalizedEventSchema.parse() each event
  → publisher.publish() each event to RabbitMQ
  → return { ok: true, published: n }
```

---

## Poller flow (not yet wired — poller-worker is a stub)

```
PollerScheduler (cron)
  → for each enabled poller connector per workspace
  → TenantContext.run({ workspaceId })
  → load config + secrets
  → connector.poll(config, workspaceId) → NormalizedEvent[]
  → NormalizedEventSchema.parse() each event
  → publisher.publish() each event
```

---

## Database

PostgreSQL only. `synchronize: true` in development (TypeORM auto-creates tables).
Production must use migrations — none written yet.

```
workspaces          workspace registry
connector_configs   per-workspace connector config + encrypted secrets
system_config       first-run state, global config (firstWorkspaceId)
```

---

## Dashboard (apps/dashboard)

Next.js 15 App Router. Tailwind CSS. No shadcn/ui installed yet.

```
/                   dashboard home — setup status, stats, getting-started steps
/setup              first-run wizard — creates workspace + system_config
/connectors         list all registered connectors with type badges + trigger pills
/connectors/[id]    configure page — enable toggle, setup instructions, config form,
                    secrets form (password fields), webhook URL display
/events             live SSE event stream — expandable event rows, clear button
```

Connector config and secrets forms are rendered dynamically from the connector's
`configSchema()` and `secretsSchema()` converted to JSON Schema via
`zod-to-json-schema`. No hardcoded forms per connector.

---

## Naming conventions

```
Apps          kebab-case directories — api, dashboard, poller-worker
Libs          kebab-case directories — connectors, crypto, messaging
Connectors    kebab-case — connectors/github, connectors/slack
Event pkgs    kebab-case — github, slack, email (folder name)
              @kairosis/github-events (package name)
NestJS        PascalCase modules, services, controllers
              camelCase methods and properties
Zod schemas   PascalCase + Schema — NormalizedEventSchema
              PascalCase + Payload — GithubCommitPushedPayload
Types         PascalCase — NormalizedEvent, GithubCommitPushed
Constants     object const — GithubEventType.COMMIT_PUSHED
Env vars      SCREAMING_SNAKE — RABBITMQ_URL, ENCRYPTION_KEY
```

---

## Key commands

```bash
# start everything (infrastructure must be running first)
npm run dev

# start infrastructure only
docker compose up -d

# start individual apps
npx nx serve api              # API on :3200
npx nx dev dashboard          # dashboard on :3001
npx nx serve poller-worker    # background worker

# generate a new connector
npm run generate:connector --name=slack
# → creates connectors/slack/ as an Nx lib
# → add to connectors.module.ts and tsconfig.base.json paths

# generate NestJS module/service inside an app
nx g @nx/nest:module [name] --project=api
nx g @nx/nest:service [name] --project=api

# generate a new internal lib
nx g @nx/js:lib [name] --directory=libs/[name] --unitTestRunner=none --bundler=tsc

# generate a new publishable event package
nx g @nx/js:lib [name]-events --directory=events/[name] \
  --publishable --importPath=@kairosis/[name]-events \
  --unitTestRunner=none --bundler=tsc

# build
nx run-many -t build --exclude=dashboard

# typecheck
npx tsc --project tsconfig.base.json --noEmit

# publishing event packages
npx changeset
npx changeset version
npx changeset publish
```

---

## Environment variables

```
PORT=3200                   API port
DASHBOARD_PORT=3001         Next.js port
NODE_ENV=development

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=kairosis
POSTGRES_USER=kairosis
POSTGRES_PASSWORD=          set to kairosis_dev for local docker

RABBITMQ_URL=amqp://kairosis:kairosis_dev@localhost:5672
RABBITMQ_EXCHANGE=kairosis.topic

ENCRYPTION_KEY=             32-byte hex — generate: openssl rand -hex 32

API_PUBLIC_URL=http://localhost:3200   shown in webhook URLs in the dashboard

NEXT_PUBLIC_API_URL=http://localhost:3200
```

---

## What not to do

- Never store or query events in a database — Kairosis publishes and forgets
- Never write to Neo4j, Qdrant, or any graph/vector database
- Never skip Zod validation before publishing an event
- Never call normalize() before verifyWebhook() on a webhook payload
- Never return secrets via API — only hasSecrets: boolean
- Never put workspaceId in a webhook URL — use webhookToken
- Never add reconnection logic for RabbitMQ — crash and let Docker restart
- Never define event types outside of the events/ folder
- Never import from events/ packages inside libs/ — libs are internal
- Never merge config and secrets into one schema or one DB column
- Never use any in TypeScript without a comment explaining why
- Never hardcode connector IDs, workspace IDs, or routing keys as strings
- Never use synchronize: true in production — write migrations

---

## Current phase

**Phase 1 — First event flow complete**

End-to-end event flow is working:
- GitHub webhook connector receives, HMAC-verifies, normalizes, and publishes events
- Supported GitHub events: push (commits), pull_request (opened/merged/closed),
  issues (opened/closed/reopened)
- Dashboard has setup wizard, connector list, connector configure page, live event stream

**What's built:**
- `apps/api` — SetupModule, WebhooksModule, ConnectorsModule, EventsModule
- `apps/dashboard` — /, /setup, /connectors, /connectors/[id], /events
- `connectors/github` — GithubConnector (IWebhookConnector)
- All libs fully implemented (crypto, tenant, messaging, connector-config, connectors)
- All event packages — events-core fully implemented, github-events with payloads,
  remaining packages have event type constants only

**What's not built yet:**
- Poller scheduler in poller-worker (app is a stub)
- Additional connectors (slack, email, calendar, etc.)
- Database migrations (using synchronize: true in dev)
- Auth / multi-workspace UI
- /workspaces and /settings dashboard pages
- Flutter mobile app
