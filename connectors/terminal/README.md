# Terminal Connector

Captures shell commands from your terminal via a shell hook in `zsh` or `bash`.

**Type:** `device`  
**Auth:** API key (`Authorization: Bearer <key>`)

## Events

| Routing key | Trigger |
|---|---|
| `terminal.command.executed` | Shell command ran and returned |
| `terminal.directory.changed` | `cd` command detected (also emits `command.executed`) |

## Configuration

| Field | Type | Description |
|---|---|---|
| `allowedHostnames` | `string[]` | Optional allow-list of hostnames. Empty = accept all machines. |

## Setup

1. Go to **API Keys** and create a key for the Terminal connector. Copy the key — it is shown only once.
2. Add the hook to your shell config. Replace `INGEST_URL` with the ingest endpoint and `API_KEY` with your key.

**zsh** — add to `~/.zshrc`:

```zsh
_kairosis_preexec() { _k_start=$(date +%s%3N); _k_cmd="$1"; }
_kairosis_precmd() {
  local x=$?
  [[ -z "$_k_cmd" ]] && return
  curl -sf -X POST "INGEST_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer API_KEY" \
    -d "{\"command\":\"$_k_cmd\",\"exitCode\":$x,\"cwd\":\"$PWD\",\"shell\":\"zsh\",\"hostname\":\"$HOST\",\"duration\":$(($(date +%s%3N)-_k_start))}" \
    >/dev/null 2>&1 &
  _k_cmd=""
}
preexec_functions+=(_kairosis_preexec)
precmd_functions+=(_kairosis_precmd)
```

**bash** — add to `~/.bashrc`:

```bash
_kairosis_hook() {
  local x=$?
  local cmd=$(history 1 | sed 's/^[[:space:]]*[0-9]*[[:space:]]*//')
  curl -sf -X POST "INGEST_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer API_KEY" \
    -d "{\"command\":\"$cmd\",\"exitCode\":$x,\"cwd\":\"$PWD\",\"shell\":\"bash\",\"hostname\":\"$HOSTNAME\"}" \
    >/dev/null 2>&1 &
}
PROMPT_COMMAND="_kairosis_hook${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
```

3. Run `source ~/.zshrc` (or open a new terminal) to activate the hook.

## Payload

```json
{
  "command": "git commit -m 'fix: typo'",
  "exitCode": 0,
  "cwd": "/home/user/project",
  "shell": "zsh",
  "duration": 142,
  "hostname": "macbook.local",
  "user": "pascal"
}
```

## Notes

- Commands are sent asynchronously (`&`) so they do not block your prompt.
- `duration` is in milliseconds (zsh only — not available in the bash hook as written).
- Use `allowedHostnames` if you run the hook on multiple machines and want to filter by host.
