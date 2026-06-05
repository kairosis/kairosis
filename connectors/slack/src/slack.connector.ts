import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  IWebhookConnector,
  ConnectorManifest,
  WebhookVerifyParams,
} from '@kairosis/connectors';
import { NormalizedEvent } from '@kairosis/events-core';
import { SlackEventType } from '@kairosis/slack-events';

const SecretsSchema = z.object({
  signingSecret: z.string().min(1),
});

const ConfigSchema = z.object({
  channels: z.array(z.string()).default([]),
});

export class SlackConnector implements IWebhookConnector {
  readonly manifest: ConnectorManifest = {
    id: 'slack',
    name: 'Slack',
    description: 'Receives Slack Events API webhooks — messages, reactions, and channel joins.',
    version: '0.1.0',
    author: 'Kairosis',
    type: 'webhook',
    triggers: Object.values(SlackEventType),
    requiresAuth: true,
    authType: 'none',
    setupInstructions: [
      'Go to api.slack.com/apps and create a new app (From Scratch).',
      'Under "Basic Information", copy the Signing Secret — paste it into the Signing Secret field below and save.',
      'Under "Event Subscriptions", enable events and paste the webhook URL shown above into the Request URL field. Slack will verify it automatically.',
      'Subscribe to bot events: message.channels, reaction_added, member_joined_channel.',
      'Install the app to your workspace under "OAuth & Permissions".',
    ],
  };

  configSchema() { return ConfigSchema; }
  secretsSchema() { return SecretsSchema; }

  challengeResponse(body: unknown): Record<string, unknown> | null {
    const b = body as Record<string, unknown>;
    if (b['type'] === 'url_verification' && typeof b['challenge'] === 'string') {
      return { challenge: b['challenge'] };
    }
    return null;
  }

  async verifyWebhook({ rawBody, headers, secrets }: WebhookVerifyParams): Promise<boolean> {
    const parsed = SecretsSchema.safeParse(secrets);
    if (!parsed.success) return false;

    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];
    if (!timestamp || typeof timestamp !== 'string' || !signature || typeof signature !== 'string') return false;

    // Reject replayed requests older than 5 minutes
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

    const sigBase = `v0:${timestamp}:${rawBody.toString('utf8')}`;
    const expected = `v0=${createHmac('sha256', parsed.data.signingSecret).update(sigBase).digest('hex')}`;

    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async normalize(body: unknown, workspaceId: string, config: unknown): Promise<NormalizedEvent[]> {
    const payload = body as Record<string, unknown>;

    if (payload['type'] === 'url_verification') return [];
    if (payload['type'] !== 'event_callback') return [];

    const event = payload['event'] as Record<string, unknown> | undefined;
    if (!event) return [];

    const parsedConfig = ConfigSchema.safeParse(config);
    const allowedChannels = parsedConfig.success ? parsedConfig.data.channels : [];
    const teamId = (payload['team_id'] as string | undefined) ?? 'unknown';
    const now = new Date().toISOString();

    const base = {
      id: randomUUID(),
      workspaceId,
      connectorId: this.manifest.id,
      occurredAt: now,
      ingestedAt: now,
      version: '1',
    };

    const eventType = event['type'] as string | undefined;

    if (eventType === 'message' && !event['subtype']) {
      const channelId = event['channel'] as string;
      if (allowedChannels.length > 0 && !allowedChannels.includes(channelId)) return [];

      const userId = (event['user'] as string | undefined) ?? 'unknown';
      return [{
        ...base,
        type: SlackEventType.MESSAGE_RECEIVED,
        actor: { id: userId, type: 'user' as const, displayName: userId },
        subject: {
          id: event['ts'] as string,
          type: 'message',
          displayName: ((event['text'] as string | undefined) ?? '').slice(0, 100),
        },
        payload: {
          teamId,
          channelId,
          userId,
          text:     (event['text'] as string | undefined) ?? '',
          ts:       (event['ts'] as string | undefined) ?? '',
          threadTs: event['thread_ts'] as string | undefined,
        },
        raw: payload,
      }];
    }

    if (eventType === 'reaction_added') {
      const userId = (event['user'] as string | undefined) ?? 'unknown';
      const item = (event['item'] as Record<string, unknown> | undefined) ?? {};
      const channelId = item['channel'] as string | undefined;

      if (allowedChannels.length > 0 && channelId && !allowedChannels.includes(channelId)) return [];

      return [{
        ...base,
        type: SlackEventType.REACTION_ADDED,
        actor: { id: userId, type: 'user' as const, displayName: userId },
        subject: {
          id:          (item['ts'] as string | undefined) ?? '',
          type:        'message',
          displayName: `:${event['reaction'] as string}:`,
        },
        payload: {
          teamId,
          userId,
          reaction:  (event['reaction'] as string | undefined) ?? '',
          itemType:  (item['type'] as string | undefined) ?? 'message',
          channelId,
          itemTs:    (item['ts'] as string | undefined) ?? '',
        },
        raw: payload,
      }];
    }

    if (eventType === 'member_joined_channel') {
      const userId = (event['user'] as string | undefined) ?? 'unknown';
      const channelId = (event['channel'] as string | undefined) ?? '';

      if (allowedChannels.length > 0 && !allowedChannels.includes(channelId)) return [];

      return [{
        ...base,
        type: SlackEventType.CHANNEL_JOINED,
        actor: { id: userId, type: 'user' as const, displayName: userId },
        subject: { id: channelId, type: 'channel', displayName: channelId },
        payload: { teamId, userId, channelId },
        raw: payload,
      }];
    }

    return [];
  }
}
