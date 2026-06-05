import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { IDeviceConnector, ConnectorManifest } from '@kairosis/connectors';
import { NormalizedEvent } from '@kairosis/events-core';
import { BrowserEventType } from '@kairosis/browser-events';

const ConfigSchema = z.object({
  blockedDomains: z.array(z.string()).default([]),
});

const BodySchema = z.object({
  type:           z.enum(['page.visited', 'tab.opened', 'tab.closed', 'tab.activated']),
  url:            z.string().optional(),
  title:          z.string().optional(),
  tabId:          z.number().int(),
  windowId:       z.number().int().optional(),
  transitionType: z.string().optional(),
});

export class BrowserConnector implements IDeviceConnector {
  readonly manifest: ConnectorManifest = {
    id:          'browser',
    name:        'Browser',
    description: 'Captures browser activity via a Chrome extension — page visits, tab opens and closes.',
    version:     '0.1.0',
    author:      'Kairosis',
    type:        'device',
    triggers:    Object.values(BrowserEventType),
    requiresAuth: true,
    authType:    'apikey',
    setupInstructions: [
      'Save this instance to generate your Device Endpoint URL.',
      'Install the Kairosis Browser Extension in Chrome.',
      'Open the extension popup and paste the Device Endpoint URL.',
      'The extension will start sending page visits and tab events immediately.',
    ],
  };

  configSchema() { return ConfigSchema; }

  async normalize(body: unknown, workspaceId: string, rawConfig: unknown): Promise<NormalizedEvent[]> {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return [];

    const config = ConfigSchema.safeParse(rawConfig);
    const blockedDomains = config.success ? config.data.blockedDomains : [];

    const { type, url, title, tabId, windowId, transitionType } = parsed.data;

    if (url && blockedDomains.length > 0) {
      try {
        const hostname = new URL(url).hostname;
        if (blockedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
          return [];
        }
      } catch {
        return [];
      }
    }

    const now = new Date().toISOString();
    const eventType = {
      'page.visited':  BrowserEventType.PAGE_VISITED,
      'tab.opened':    BrowserEventType.TAB_OPENED,
      'tab.closed':    BrowserEventType.TAB_CLOSED,
      'tab.activated': BrowserEventType.TAB_ACTIVATED,
    }[type];

    return [{
      id:          randomUUID(),
      workspaceId,
      connectorId: this.manifest.id,
      type:        eventType,
      occurredAt:  now,
      ingestedAt:  now,
      version:     '1',
      subject: url ? {
        id:          url,
        type:        'webpage',
        displayName: title ?? url,
        url,
      } : undefined,
      payload: { url, title, tabId, windowId, transitionType },
      raw: body,
    }];
  }
}
