# Kairosis

**Your digital life, as a structured event stream.**

Kairosis is a self-hosted event collection and normalization platform. It connects to the tools you use every day — email, Slack, calendar, GitHub, your browser, your smartwatch — and turns the raw activity into a clean, structured event stream over AMQP.

Whatever you build on top of that stream is up to you.

---

## The problem

Your digital life is scattered across dozens of tools, each with its own format, its own API, its own quirks. Getting a unified view of what's happening — across email, code, calendar, health, location — means writing the same glue code over and over.

Kairosis does that once, well, so you don't have to.

```
Gmail arrives        → email.received        { from, subject, body, thread }
PR gets merged       → github.pr.merged      { repo, title, author, diff }
Meeting ends         → calendar.event.ended  { title, attendees, duration }
You fall asleep      → health.sleep.started  { hrv, timestamp }
You arrive somewhere → location.arrived      { place, category, time }
```

One stream. One format. Every source.

---

## What Kairosis does

**Collects** raw signals from your connected tools — via webhooks, polling, local agents, and device integrations.

**Normalizes** every signal into a common `NormalizedEvent` envelope with typed payloads per event type.

**Publishes** every event to a RabbitMQ topic exchange, where any number of consumers can subscribe to exactly what they need.

**Verifies** webhook payloads using each connector's own signature verification — nothing untrusted enters the stream.

---

## Event envelope

Every event, regardless of source, has the same shape:

```typescript
{
  id:          "uuid",
  workspaceId: "uuid",
  source:      "gmail",
  type:        "email.received",
  occurredAt:  "2026-06-03T08:14:00Z",   // when it happened
  ingestedAt:  "2026-06-03T08:14:02Z",   // when Kairosis processed it
  actor: {
    id:    "user@example.com",
    name:  "Pascal Wilbrink",
    email: "user@example.com"
  },
  summary:   "Email from team@company.com: Q3 planning",
  payload:   { ... },                     // typed per event type
  tags:      ["email", "inbound"],
  sessionId: "thread-id-abc"             // groups related events
}
```

Payload schemas are defined and validated with Zod. The envelope and all
event types are published as individual npm packages — see [Events](#events).

---

## Connectors

Kairosis ships with connectors for the most common sources. All connectors
are opt-in and configured per workspace.

### Communication

| Connector | Type | Events |
|---|---|---|
| Gmail / IMAP | poller | email.received · email.sent · email.thread.replied |
| Slack | webhook | slack.message.sent · slack.reaction.added · slack.file.shared |
| Microsoft Teams | webhook | teams.message.sent · teams.meeting.ended |
| Discord | webhook | discord.message.sent · discord.reaction.added |

### Productivity

| Connector | Type | Events |
|---|---|---|
| Google Calendar | poller | calendar.event.created · calendar.event.started · calendar.event.ended |
| Outlook Calendar | poller | calendar.event.created · calendar.event.started · calendar.event.ended |
| GitHub | webhook | github.commit.pushed · github.pr.opened · github.pr.merged · github.issue.opened · github.star.given |
| Linear | webhook | linear.issue.created · linear.issue.updated · linear.pr.merged |
| Todoist | webhook | todoist.task.created · todoist.task.completed |

### Knowledge

| Connector | Type | Events |
|---|---|---|
| Obsidian | watcher | obsidian.note.created · obsidian.note.modified · obsidian.link.created |
| Notion | poller | notion.page.created · notion.page.updated · notion.database.entry.created |
| Readwise | poller | readwise.highlight.created · readwise.article.completed |
| Zotero | poller | zotero.item.added · zotero.annotation.created |

### Local

| Connector | Type | Events |
|---|---|---|
| Browser | extension | browser.page.visited · browser.reading.completed · browser.download.completed |
| Terminal | agent | terminal.command.executed · terminal.directory.changed · terminal.process.longrunning |

### Health & Location

| Connector | Type | Events |
|---|---|---|
| Health Connect | device | health.sleep.session.completed · health.hrv.recorded · health.workout.completed · health.readiness.daily |
| HealthKit | device | health.sleep.session.completed · health.hrv.recorded · health.workout.completed |
| Geofencing | device | location.arrived · location.departed · location.transit.ended |

### Synthesized

Kairosis generates meta-events by combining signals across connectors:

| Event | Description |
|---|---|
| `kairosis.day.started` | Daily summary — connectors active, first signal |
| `kairosis.focus.session.detected` | Inferred from terminal + browser + calendar alignment |
| `kairosis.context.switch.detected` | Rapid project switching detected |
| `kairosis.quiet.period.detected` | Unusual gap in signals |

---

## Community connectors

Build your own connector using the SDK:

```bash
npm install @kairosis/connector-sdk
```

```typescript
import { WebhookConnector, NormalizedEvent } from '@kairosis/connector-sdk';
import { z } from 'zod';

export class LinearConnector extends WebhookConnector {
  manifest = {
    id:      'linear',
    name:    'Linear',
    version: '1.0.0',
    type:    'webhook' as const,
  };

  configSchema() {
    return z.object({
      teams: z.array(z.string()).default([]),
    });
  }

  secretsSchema() {
    return z.object({
      webhookSecret: z.string(),
    });
  }

  async verifyWebhook({ headers, rawBody, secrets }) {
    // verify HMAC signature
  }

  async normalize(body, workspaceId, config): Promise<NormalizedEvent[]> {
    // return normalized events
  }
}
```

Publish as `@kairosis/connector-[name]` and submit to the community registry.

---

## Events

Event type constants and payload schemas are published as individual npm
packages — one per source. Install only what you need.

| Package | Description |
|---|---|
| `@kairosis/events-core` | `NormalizedEvent` envelope · base types · routing keys |
| `@kairosis/events` | Convenience — re-exports all packages below |
| `@kairosis/github-events` | GitHub event types and payload schemas |
| `@kairosis/slack-events` | Slack event types and payload schemas |
| `@kairosis/email-events` | Email event types and payload schemas |
| `@kairosis/calendar-events` | Calendar event types and payload schemas |
| `@kairosis/browser-events` | Browser event types and payload schemas |
| `@kairosis/terminal-events` | Terminal event types and payload schemas |
| `@kairosis/health-events` | Health and biometric event types |
| `@kairosis/location-events` | Location and geofencing event types |
| `@kairosis/obsidian-events` | Obsidian vault event types |
| `@kairosis/notion-events` | Notion event types |
| `@kairosis/synthesized-events` | Kairosis-generated meta events |

All event packages live in the `events/` folder of this repository.

---

## Routing

Kairosis publishes to a RabbitMQ topic exchange. Consumers subscribe to
exactly the events they care about:

```
Exchange: kairosis.topic

Pattern           Matches
────────────────────────────────────────────
email.#           all email events
slack.message.#   all Slack message events
github.pr.#       all GitHub PR events
health.#          all health events
#                 everything
```

---

## Connector config

Every connector has two configuration surfaces — both validated with Zod:

**Config** — non-sensitive settings stored in plaintext. Rendered as a
form in the dashboard automatically from the Zod schema.

**Secrets** — sensitive values (API keys, signing secrets, tokens) stored
encrypted with AES-256-GCM. Never returned via API — only a `hasSecrets`
boolean is exposed.

Webhook connectors receive a stable per-workspace URL:

```
POST https://your-kairosis-instance.com/webhooks/:connectorId/:workspaceToken
```

Each source posts to this URL. Kairosis verifies the signature using the
connector's stored secrets before accepting the payload.

---

## Privacy

- Everything runs on your own hardware
- No telemetry, no analytics, no cloud callbacks
- Secrets are encrypted at rest with AES-256-GCM
- Webhook URLs use opaque tokens — your workspace ID is never exposed
- Sensitive events can be marked private — excluded from downstream consumers

---

## Quick start

```bash
git clone https://github.com/Kairosis/kairosis
cd kairosis
cp .env.example .env
docker compose up
```

Open [http://localhost:3001](http://localhost:3001) to complete setup.

The setup wizard guides you through:
1. Creating your workspace
2. Enabling connectors
3. Configuring your RabbitMQ exchange
4. Connecting your first source

---

## Hardware requirements

| Profile | RAM | CPU | Notes |
|---|---|---|---|
| Minimal | 1GB | 1 core | Few connectors, low frequency |
| Recommended | 2GB | 2 cores | All connectors, normal usage |
| High volume | 4GB+ | 4+ cores | Many workspaces, high frequency |

Kairosis is intentionally lightweight — it normalizes and publishes, it
doesn't store or process beyond that.

---

## Roadmap

- [x] Architecture design
- [ ] Phase 0 — Foundation
- [ ] Phase 1 — Core connectors (email · Slack · calendar · GitHub)
- [ ] Phase 2 — Local connectors (browser · terminal)
- [ ] Phase 3 — Health + location connectors
- [ ] Phase 4 — Knowledge connectors (Obsidian · Notion · Readwise)
- [ ] Phase 5 — Synthesized events
- [ ] Phase 6 — Open source launch
- [ ] Phase 7 — Community connectors

---

## For developers

### Repository structure

```
kairosis/
  apps/
    api/                NestJS REST API + webhook receiver
    dashboard/          React connector management UI
    poller-worker/      Scheduled polling connectors
  events/
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
  packages/
    connector-sdk/      → @kairosis/connector-sdk
  libs/
    connectors/         Connector interface + registry (internal)
    connector-config/   Config + secrets storage (internal)
    crypto/             AES-256-GCM encryption (internal)
    messaging/          RabbitMQ publisher (internal)
    tenant/             Workspace context (internal)
    ui/                 Shared React components (internal)
```

```
apps/       runs as a process — deployed, dockerized
events/     published to npm — shared event contracts
packages/   published to npm — tooling for connector authors
libs/       internal only — not published
```

### Tech stack

| Layer | Technology |
|---|---|
| Backend | NestJS (Nx monorepo) |
| Dashboard | React · Next.js · shadcn/ui · Tailwind |
| Message broker | RabbitMQ (AMQP) |
| Operational data | PostgreSQL (Drizzle) |
| Validation | Zod throughout |
| Mobile | Flutter (watch + location) |
| Encryption | AES-256-GCM |

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Kairosis Dashboard                     │
│        Connectors · Workspaces · Event log           │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│                    REST API                           │
│   /connectors · /workspaces · /webhooks · /events    │
└──┬───────────────────────────────────────────────────┘
   │
┌──▼───────────────────────────────────────────────────┐
│               Connector Registry                      │
│   webhook connectors   → WebhookController           │
│   poller connectors    → PollerScheduler             │
│   device connectors    → DeviceController            │
│   import connectors    → ImportRunner                │
└──┬───────────────────────────────────────────────────┘
   │ normalizes → validates → NormalizedEventSchema
┌──▼───────────────────────────────────────────────────┐
│                    RabbitMQ                           │
│              kairosis.topic exchange                   │
│   email.# · slack.# · github.# · health.# · ...     │
└──────────────────────────────────────────────────────┘
               ↑ consumed by downstream systems
```

### Connector types

```
WebhookConnector    receives HTTP POST from external service
                    implements verifyWebhook() + normalize()

PollerConnector     fetches on a configurable cron schedule
                    implements poll() → NormalizedEvent[]

DeviceConnector     receives pushes from local device or app
                    implements normalize()

ImportConnector     bulk one-time or periodic import
                    implements import() as AsyncGenerator

SyncConnector       bidirectional — import + export + live sync
                    implements import() + export() + sync?()
```

---

## Documentation

Full documentation at **[kairosis.github.io](https://kairosis.github.io)** — connector reference, event schemas, SDK guides, and self-hosting instructions.

---

## Contributing

- Build a connector using [`@kairosis/connector-sdk`](https://github.com/Kairosis/kairosis/tree/main/packages/connector-sdk)
- Open issues for bugs or feature requests
- Join the discussion in GitHub Discussions
- Submit PRs for documentation, fixes, or new features

See [CONTRIBUTING.md](https://github.com/Kairosis/.github/blob/main/CONTRIBUTING.md) for full guidelines.

---

## License

MIT © Pascal Wilbrink