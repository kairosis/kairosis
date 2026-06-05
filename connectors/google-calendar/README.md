# Google Calendar Connector

Polls Google Calendar for new, updated, and deleted events using the Calendar API incremental sync.

**Type:** `poller` (runs every minute)  
**Auth:** OAuth 2.0 refresh token (manual setup — not the built-in OAuth2 flow)

## Events

| Routing key | Trigger |
|---|---|
| `calendar.event.created` | New calendar event detected |
| `calendar.event.updated` | Existing event modified |
| `calendar.event.deleted` | Event cancelled or removed |

## Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `calendarId` | `string` | `primary` | Google Calendar ID to poll |
| `lookbackDays` | `number` | `7` | Days back to fetch on first run |

## Secrets

| Field | Description |
|---|---|
| `clientId` | OAuth 2.0 Client ID from Google Cloud Console |
| `clientSecret` | OAuth 2.0 Client Secret |
| `refreshToken` | Refresh token with `calendar.readonly` scope |

## Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project and enable the **Google Calendar API**.
2. Under **APIs & Services → Credentials**, create an **OAuth 2.0 Client ID** (type: Desktop App). Copy the Client ID and Client Secret.
3. Open [OAuth Playground](https://developers.google.com/oauthplayground) — click the gear icon, check **Use your own OAuth credentials** and enter your Client ID and Secret.
4. In Step 1, enter scope: `https://www.googleapis.com/auth/calendar.readonly` — click **Authorize APIs** and sign in.
5. In Step 2, click **Exchange authorization code for tokens**. Copy the **Refresh Token**.
6. Paste Client ID, Client Secret, and Refresh Token into the Secrets fields.

## Notes

- Uses Google's [incremental sync](https://developers.google.com/calendar/api/guides/sync) (sync tokens) after the initial fetch — only changed events are fetched on subsequent polls.
- If the sync token expires (HTTP 410), the connector automatically falls back to a full re-sync.
- `created` vs `updated` is determined by comparing `created` and `updated` timestamps — events where they differ by less than 2 seconds are treated as newly created.
- All-day events use `date` instead of `dateTime` in the payload.
