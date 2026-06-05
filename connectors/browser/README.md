# Browser Connector

Captures browser activity from a Chrome extension — page visits, tab opens, closes, and activations.

**Type:** `device`  
**Auth:** API key (`Authorization: Bearer <key>`)

## Events

| Routing key | Trigger |
|---|---|
| `browser.page.visited` | Navigation completed to a page |
| `browser.tab.opened` | New tab opened |
| `browser.tab.closed` | Tab closed |
| `browser.tab.activated` | Tab brought into focus |

## Configuration

| Field | Type | Description |
|---|---|---|
| `blockedDomains` | `string[]` | Domains to suppress. Subdomains are also blocked (e.g. `google.com` blocks `mail.google.com`). |

## Setup

1. Save this instance to generate your **Device Endpoint URL**.
2. Install the Kairosis Browser Extension in Chrome.
3. Open the extension popup and paste the Device Endpoint URL and your API key.
4. The extension will start sending page visits and tab events immediately.

## Payload

```json
{
  "type": "browser.page.visited",
  "url": "https://example.com/page",
  "title": "Example Page",
  "tabId": 42,
  "windowId": 1,
  "transitionType": "link"
}
```

## Notes

- The extension sends events directly to the Kairosis API — no polling involved.
- `blockedDomains` filtering happens server-side after the event is received; the extension always sends.
- `transitionType` reflects Chrome's navigation type (`link`, `typed`, `reload`, `auto_bookmark`, etc.).
