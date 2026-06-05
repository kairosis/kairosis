import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { IDeviceConnector, ConnectorManifest } from '@kairosis/connectors';
import { NormalizedEvent } from '@kairosis/events-core';
import { DesktopEventType } from '@kairosis/desktop-events';

const ConfigSchema = z.object({});

const BodySchema = z.discriminatedUnion('type', [
  z.object({
    type:     z.literal('app.activated'),
    appName:  z.string().min(1),
    bundleId: z.string().optional(),
  }),
  z.object({ type: z.literal('screen.locked') }),
  z.object({ type: z.literal('screen.unlocked') }),
  z.object({
    type:        z.literal('idle.started'),
    idleSeconds: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('idle.ended') }),
  z.object({
    type:     z.literal('battery.changed'),
    charging: z.boolean(),
  }),
]);

export class DesktopConnector implements IDeviceConnector {
  readonly manifest: ConnectorManifest = {
    id:          'desktop',
    name:        'Desktop',
    description: 'Captures desktop activity — active apps, screen lock, idle detection, and battery status via the Kairosis Desktop app.',
    version:     '0.1.0',
    author:      'Kairosis',
    type:        'device',
    triggers:    Object.values(DesktopEventType),
    requiresAuth: true,
    authType:    'apikey',
    setupInstructions: [
      'Save this connector instance to generate your Device Token.',
      'Open the Kairosis Desktop app on your Mac.',
      'Paste the Device Token and your API endpoint into the Desktop app settings.',
      'Choose which events to track and optionally block apps from being recorded.',
    ],
  };

  configSchema() { return ConfigSchema; }

  async normalize(body: unknown, workspaceId: string): Promise<NormalizedEvent[]> {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return [];

    const now  = new Date().toISOString();
    const base = {
      id:          randomUUID(),
      workspaceId,
      connectorId: this.manifest.id,
      occurredAt:  now,
      ingestedAt:  now,
      version:     '1',
    };

    const data = parsed.data;

    switch (data.type) {
      case 'app.activated':
        return [{
          ...base,
          type:    DesktopEventType.APP_ACTIVATED,
          subject: { id: data.appName, type: 'application', displayName: data.appName },
          payload: { appName: data.appName, bundleId: data.bundleId ?? null },
        }];

      case 'screen.locked':
        return [{ ...base, type: DesktopEventType.SCREEN_LOCKED, payload: {} }];

      case 'screen.unlocked':
        return [{ ...base, type: DesktopEventType.SCREEN_UNLOCKED, payload: {} }];

      case 'idle.started':
        return [{ ...base, type: DesktopEventType.IDLE_STARTED, payload: { idleSeconds: data.idleSeconds } }];

      case 'idle.ended':
        return [{ ...base, type: DesktopEventType.IDLE_ENDED, payload: {} }];

      case 'battery.changed':
        return [{ ...base, type: DesktopEventType.BATTERY_CHANGED, payload: { charging: data.charging } }];

      default:
        return [];
    }
  }
}
