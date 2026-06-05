import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { IDeviceConnector, ConnectorManifest } from '@kairosis/connectors';
import { NormalizedEvent } from '@kairosis/events-core';
import { TerminalEventType } from '@kairosis/terminal-events';

const ConfigSchema = z.object({
  allowedHostnames: z.array(z.string()).default([]),
});

const BodySchema = z.object({
  command:  z.string().min(1),
  exitCode: z.number().int().optional(),
  cwd:      z.string().default(''),
  shell:    z.string().optional(),
  duration: z.number().nonnegative().optional(),
  hostname: z.string().optional(),
  user:     z.string().optional(),
});

export class TerminalConnector implements IDeviceConnector {
  readonly manifest: ConnectorManifest = {
    id:          'terminal',
    name:        'Terminal',
    description: 'Captures shell commands from your terminal via a shell hook.',
    version:     '0.1.0',
    author:      'Kairosis',
    type:        'device',
    triggers:    [TerminalEventType.COMMAND_EXECUTED, TerminalEventType.DIRECTORY_CHANGED],
    requiresAuth: true,
    authType:    'apikey',
    setupInstructions: [
      'Go to API Keys and create a key for the Terminal connector. Copy the key — it is shown only once.',
      'Add the following to your ~/.zshrc — replace INGEST_URL with the ingest endpoint and API_KEY with your key:',
      'zsh: add _kairosis_preexec() { _k_start=$(date +%s%3N); _k_cmd="$1"; } and _kairosis_precmd() { local x=$?; [[ -z "$_k_cmd" ]] && return; curl -sf -X POST "INGEST_URL" -H "Content-Type: application/json" -H "Authorization: Bearer API_KEY" -d "{\"command\":\"$_k_cmd\",\"exitCode\":$x,\"cwd\":\"$PWD\",\"shell\":\"zsh\",\"hostname\":\"$HOST\",\"duration\":$(($(date +%s%3N)-_k_start))}" >/dev/null 2>&1 &; _k_cmd=""; } and preexec_functions+=(_kairosis_preexec) and precmd_functions+=(_kairosis_precmd)',
      'bash: add _kairosis_hook() { local x=$?; local cmd=$(history 1 | sed "s/^[[:space:]]*[0-9]*[[:space:]]*//"); curl -sf -X POST "INGEST_URL" -H "Content-Type: application/json" -H "Authorization: Bearer API_KEY" -d "{\"command\":\"$cmd\",\"exitCode\":$x,\"cwd\":\"$PWD\",\"shell\":\"bash\",\"hostname\":\"$HOSTNAME\"}" >/dev/null 2>&1 &; } and PROMPT_COMMAND="_kairosis_hook${PROMPT_COMMAND:+; $PROMPT_COMMAND}"',
      'Run source ~/.zshrc (or open a new terminal) to activate the hook.',
    ],
  };

  configSchema() { return ConfigSchema; }

  async normalize(body: unknown, workspaceId: string, rawConfig: unknown): Promise<NormalizedEvent[]> {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return [];

    const config = ConfigSchema.safeParse(rawConfig);
    const allowedHostnames = config.success ? config.data.allowedHostnames : [];

    const { command, exitCode, cwd, shell, duration, hostname, user } = parsed.data;

    if (allowedHostnames.length > 0 && hostname && !allowedHostnames.includes(hostname)) {
      return [];
    }

    const now = new Date().toISOString();
    const base = {
      workspaceId,
      connectorId: this.manifest.id,
      occurredAt:  now,
      ingestedAt:  now,
      version:     '1',
      actor: user ? { id: user, type: 'user' as const, displayName: user } : undefined,
    };

    const events: NormalizedEvent[] = [{
      ...base,
      id:      randomUUID(),
      type:    TerminalEventType.COMMAND_EXECUTED,
      subject: { id: randomUUID(), type: 'command', displayName: command.slice(0, 100) },
      payload: { command, exitCode, cwd, shell, duration, hostname, user },
      raw:     body,
    }];

    // Emit DIRECTORY_CHANGED for cd commands
    if (/^cd(\s|$)/.test(command.trimStart()) && cwd) {
      events.push({
        ...base,
        id:      randomUUID(),
        type:    TerminalEventType.DIRECTORY_CHANGED,
        subject: { id: cwd, type: 'directory', displayName: cwd },
        payload: { cwd, hostname, user },
        raw:     body,
      });
    }

    return events;
  }
}
