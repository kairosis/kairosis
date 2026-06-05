# Slack Connector

Receives Slack Events API webhooks and normalizes them into Kairosis events.

**Type:** `webhook`  
**Auth:** HMAC signature (`x-slack-signature`)

## Events

| Routing key | Trigger |
|---|---|
| `slack.message.received` | Message posted in a channel |
| `slack.reaction.added` | Reaction added to a message |
| `slack.channel.joined` | Member joined a channel |

## Configuration

| Field | Type | Description |
|---|---|---|
| `channels` | `string[]` | Optional allow-list of channel IDs. Empty = accept all channels. |

## Secrets

| Field | Description |
|---|---|
| `signingSecret` | The Signing Secret from your Slack app's Basic Information page. Used to verify `x-slack-signature`. |

## Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app (**From Scratch**).
2. Under **Basic Information**, copy the **Signing Secret** — paste it into the Signing Secret field below and save.
3. Under **Event Subscriptions**, enable events and paste the webhook URL into the **Request URL** field. Slack will verify it automatically.
4. Subscribe to bot events: `message.channels`, `reaction_added`, `member_joined_channel`.
5. Install the app to your workspace under **OAuth & Permissions**.

## Notes

- Slack's `url_verification` challenge is handled automatically — no action needed.
- Message subtypes (edits, deletes, bot messages) are ignored; only plain user messages are emitted.
- Replay protection is enforced: requests older than 5 minutes are rejected.
