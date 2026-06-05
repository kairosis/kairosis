# GitHub Connector

Receives GitHub webhook events and normalizes them into Kairosis events.

**Type:** `webhook`  
**Auth:** HMAC signature (`x-hub-signature-256`)

## Events

| Routing key | Trigger |
|---|---|
| `github.commit.pushed` | One event per commit on a push |
| `github.pr.opened` | Pull request opened or reopened |
| `github.pr.merged` | Pull request merged |
| `github.pr.closed` | Pull request closed without merging |
| `github.issue.opened` | Issue opened |
| `github.issue.closed` | Issue closed |
| `github.issue.reopened` | Issue reopened |

## Configuration

| Field | Type | Description |
|---|---|---|
| `repositories` | `string[]` | Optional allow-list of `owner/repo` names. Empty = accept all. |

## Secrets

| Field | Description |
|---|---|
| `webhookSecret` | The secret string configured in the GitHub webhook settings. Used to verify `x-hub-signature-256`. |

## Setup

1. Go to your GitHub repository → **Settings → Webhooks → Add webhook**.
2. Set the **Payload URL** to the webhook URL shown on the connector page after saving.
3. Set **Content type** to `application/json`.
4. Enter a strong random string as the **Secret** — use the same value in the Webhook Secret field.
5. Under **Which events?**, select Push, Pull requests, and Issues (or "Send me everything").
6. Click **Add webhook**. GitHub sends a ping — a 200 response confirms it is working.

## Notes

- Each commit in a push is emitted as a separate `github.commit.pushed` event.
- PR comment events and review events are not currently handled and are silently ignored.
- The connector can be registered on a repository webhook or an organization webhook.
