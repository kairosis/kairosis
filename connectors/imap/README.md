# IMAP Email Connector

Polls an IMAP mailbox for new messages and emits an event for each one.

**Type:** `poller` (runs every minute)  
**Auth:** Username + password / app password

## Events

| Routing key | Trigger |
|---|---|
| `email.received` | New message found in the configured mailbox |

## Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `host` | `string` | — | IMAP server hostname (e.g. `imap.gmail.com`) |
| `port` | `number` | `993` | IMAP port |
| `tls` | `boolean` | `true` | Use TLS/SSL |
| `mailbox` | `string` | `INBOX` | Mailbox folder to poll |
| `initialSyncDays` | `number` | `7` | How many days back to fetch on first run |

## Secrets

| Field | Description |
|---|---|
| `username` | Your email address |
| `password` | Account password or app password |

## Setup

1. Enter your IMAP server host, port (usually `993` for TLS), and mailbox name.
2. Enter your email address as the username and your account password (or app password).
3. **Gmail:** enable IMAP in Settings → Forwarding and POP/IMAP, and use an [App Password](https://myaccount.google.com/apppasswords) if 2FA is active.
4. **Outlook / Office 365:** use `imap.outlook.com` on port `993`.
5. Save to start polling. New messages are emitted on each poll cycle.

## Notes

- State is tracked by IMAP UID. Only messages with a UID higher than the last seen UID are fetched.
- Message body (plain text and HTML) is included in the payload when available.
- A `snippet` field contains the first 500 characters of the plain-text body.
