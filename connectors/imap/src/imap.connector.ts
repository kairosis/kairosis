import { randomUUID } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { IPollerConnector, ConnectorManifest, PollResult } from '@kairosis/connectors';
import { EmailEventType } from '@kairosis/email-events';

const ConfigSchema = z.object({
  host: z.string().min(1),
  port:            z.coerce.number().int().positive().catch(993),
  tls:             z.preprocess((v) => (v === '' || v == null) ? true : v, z.coerce.boolean()).catch(true),
  mailbox:         z.string().default('INBOX'),
  initialSyncDays: z.coerce.number().int().positive().catch(7),
});

const SecretsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

interface ImapState {
  lastUid: number;
}

export class ImapConnector implements IPollerConnector {

  private readonly logger = new Logger(ImapConnector.name);

  readonly manifest: ConnectorManifest = {
    id: 'imap',
    name: 'IMAP Email',
    description: 'Polls an IMAP mailbox for new messages and emits email.received events.',
    version: '0.1.0',
    author: 'Kairosis',
    type: 'poller',
    triggers: [EmailEventType.RECEIVED],
    requiresAuth: true,
    authType: 'none',
    setupInstructions: [
      'Enter your IMAP server host, port (usually 993 for TLS), and mailbox name.',
      'Enter your email address as the username and your account password (or app password).',
      'For Gmail: enable IMAP in Settings and use an App Password if 2FA is active.',
      'For Outlook/Office 365: use imap.outlook.com on port 993.',
      'Save to start polling. New messages are emitted on each poll cycle (every minute).',
    ],
  };

  configSchema() { return ConfigSchema; }
  secretsSchema() { return SecretsSchema; }

  async poll(
    rawConfig: unknown,
    rawSecrets: unknown,
    rawState: unknown,
    workspaceId: string,
  ): Promise<PollResult> {
    this.logger.log(`Polling IMAP for workspace ${workspaceId}`);
    const config = ConfigSchema.parse(rawConfig);
    const secrets = SecretsSchema.parse(rawSecrets);
    const state = this.parseState(rawState);

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls,
      auth: { user: secrets.username, pass: secrets.password },
      logger: false,
    });

    await client.connect();

    const events: PollResult['events'] = [];
    let maxUid = state.lastUid;

    try {
      const lock = await client.getMailboxLock(config.mailbox);
      try {
        const uids = await this.searchNewUids(client, state, config.initialSyncDays);

        this.logger.log(`Found ${uids.length} new emails`);

        if (uids.length > 0) {
          for await (const msg of client.fetch(uids, { envelope: true, uid: true, source: true }, { uid: true })) {
            if (!msg.envelope) continue;

            const uid = msg.uid;
            const env = msg.envelope;
            const from = env.from?.[0];
            const date = env.date ?? new Date();
            const subject = env.subject ?? '(no subject)';
            const msgId = env.messageId ?? `${uid}@${config.host}`;
            const now = new Date().toISOString();

            if (uid > maxUid) maxUid = uid;

            const parsed = msg.source ? await simpleParser(msg.source) : null;
            const body     = parsed?.text  ?? undefined;
            const bodyHtml = parsed?.html  ?? undefined;
            const snippet  = body ? body.slice(0, 500).trim() || undefined : undefined;

            events.push({
              id: randomUUID(),
              workspaceId,
              connectorId: this.manifest.id,
              type: EmailEventType.RECEIVED,
              occurredAt: date.toISOString(),
              ingestedAt: now,
              version: '1',
              actor: from
                ? { id: from.address ?? 'unknown', type: 'user', displayName: from.name || from.address }
                : undefined,
              subject: {
                id: msgId,
                type: 'email',
                displayName: subject,
              },
              payload: {
                messageId: msgId,
                uid,
                mailbox: config.mailbox,
                from: from ? { name: from.name, address: from.address ?? '' } : { address: 'unknown' },
                to: (env.to ?? []).map((a) => ({ name: a.name, address: a.address ?? '' })),
                cc: (env.cc ?? []).map((a) => ({ name: a.name, address: a.address ?? '' })),
                subject,
                date: date.toISOString(),
                snippet,
                body,
                bodyHtml,
              },
              raw: { uid, messageId: msgId, subject },
            });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return {
      events,
      state: { lastUid: maxUid },
    };
  }

  private async searchNewUids(
    client: ImapFlow,
    state: ImapState,
    initialSyncDays: number,
  ): Promise<number[]> {
    if (state.lastUid === 0) {
      const since = new Date();
      since.setDate(since.getDate() - initialSyncDays);
      return client.search({ since }, { uid: true }) as Promise<number[]>;
    }
    const results = await (client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true }) as Promise<number[]>);
    // IMAP returns the last message even if UID matches exactly when range is *:* — filter it out
    return results.filter((uid) => uid > state.lastUid);
  }

  private parseState(raw: unknown): ImapState {
    if (raw && typeof raw === 'object' && 'lastUid' in raw) {
      const uid = (raw as Record<string, unknown>)['lastUid'];
      if (typeof uid === 'number') return { lastUid: uid };
    }
    return { lastUid: 0 };
  }
}
