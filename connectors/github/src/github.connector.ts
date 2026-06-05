import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  IWebhookConnector,
  ConnectorManifest,
  WebhookVerifyParams,
} from '@kairosis/connectors';
import { NormalizedEvent } from '@kairosis/events-core';
import { GithubEventType } from '@kairosis/github-events';

const SecretsSchema = z.object({
  webhookSecret: z.string().min(1),
});

const ConfigSchema = z.object({
  repositories: z.array(z.string()).default([]),
});

export class GithubConnector implements IWebhookConnector {
  readonly manifest: ConnectorManifest = {
    id: 'github',
    name: 'GitHub',
    description: 'Receives GitHub webhook events — push, pull requests, issues, releases.',
    version: '0.1.0',
    author: 'Kairosis',
    type: 'webhook',
    triggers: Object.values(GithubEventType),
    requiresAuth: true,
    authType: 'none',
    setupInstructions: [
      'Go to your GitHub repository → Settings → Webhooks → Add webhook.',
      'Set the Payload URL to the webhook URL shown on this page after saving.',
      'Set Content type to application/json.',
      'Enter a strong random string as the Secret — use the same value in the Webhook Secret field below.',
      'Under "Which events?", select Push, Pull requests, and Issues (or "Send me everything").',
      'Click Add webhook. GitHub sends a ping — a 200 response confirms it is working.',
    ],
  };

  configSchema() { return ConfigSchema; }
  secretsSchema() { return SecretsSchema; }

  async verifyWebhook({ rawBody, headers, secrets }: WebhookVerifyParams): Promise<boolean> {
    const parsed = SecretsSchema.safeParse(secrets);
    if (!parsed.success) return false;

    const signature = headers['x-hub-signature-256'];
    if (!signature || typeof signature !== 'string') return false;

    const expected = `sha256=${createHmac('sha256', parsed.data.webhookSecret).update(rawBody).digest('hex')}`;

    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async normalize(body: unknown, workspaceId: string, config: unknown): Promise<NormalizedEvent[]> {
    const payload = body as Record<string, unknown>;
    const now = new Date().toISOString();

    const base = {
      id: randomUUID(),
      workspaceId,
      connectorId: this.manifest.id,
      occurredAt: now,
      ingestedAt: now,
      version: '1',
    };

    // push event
    if (payload['ref'] && payload['commits'] && payload['repository']) {
      const repo = (payload['repository'] as Record<string, unknown>)['full_name'] as string;
      const ref = payload['ref'] as string;
      const branch = ref.replace('refs/heads/', '');
      const commits = payload['commits'] as Array<Record<string, unknown>>;

      return commits.map((commit) => ({
        ...base,
        id: randomUUID(),
        type: GithubEventType.COMMIT_PUSHED,
        actor: {
          id: ((commit['author'] as Record<string, unknown>)?.['email'] as string) ?? 'unknown',
          type: 'user' as const,
          displayName: (commit['author'] as Record<string, unknown>)?.['name'] as string,
          email: (commit['author'] as Record<string, unknown>)?.['email'] as string,
        },
        subject: {
          id: commit['id'] as string,
          type: 'commit',
          displayName: (commit['message'] as string).split('\n')[0],
          url: commit['url'] as string,
        },
        payload: {
          repository: repo,
          branch,
          commitSha: commit['id'] as string,
          message: commit['message'] as string,
          authorName: (commit['author'] as Record<string, unknown>)?.['name'] as string,
          url: commit['url'] as string,
          additions: (commit['added'] as unknown[])?.length ?? 0,
          deletions: (commit['deleted'] as unknown[])?.length ?? 0,
          filesChanged: (commit['files'] as unknown[])?.length ?? 0,
        },
        raw: commit,
      }));
    }

    // pull_request event
    if (payload['pull_request'] && payload['action']) {
      const pr = payload['pull_request'] as Record<string, unknown>;
      const action = payload['action'] as string;
      const repo = (payload['repository'] as Record<string, unknown>)?.['full_name'] as string;

      let type: string;
      if (action === 'opened' || action === 'reopened') type = GithubEventType.PR_OPENED;
      else if (action === 'closed' && pr['merged']) type = GithubEventType.PR_MERGED;
      else if (action === 'closed') type = GithubEventType.PR_CLOSED;
      else return [];

      return [{
        ...base,
        type,
        actor: {
          id: ((pr['user'] as Record<string, unknown>)?.['login'] as string) ?? 'unknown',
          type: 'user' as const,
          displayName: (pr['user'] as Record<string, unknown>)?.['login'] as string,
        },
        subject: {
          id: String(pr['number']),
          type: 'pull_request',
          displayName: pr['title'] as string,
          url: pr['html_url'] as string,
        },
        payload: {
          repository: repo,
          prNumber: pr['number'] as number,
          title: pr['title'] as string,
          body: pr['body'] as string | undefined,
          authorName: (pr['user'] as Record<string, unknown>)?.['login'] as string,
          headBranch: (pr['head'] as Record<string, unknown>)?.['ref'] as string,
          baseBranch: (pr['base'] as Record<string, unknown>)?.['ref'] as string,
          url: pr['html_url'] as string,
          draft: (pr['draft'] as boolean) ?? false,
          mergedBy: type === GithubEventType.PR_MERGED
            ? (pr['merged_by'] as Record<string, unknown>)?.['login'] as string
            : undefined,
        },
        raw: payload,
      }];
    }

    // issues event
    if (payload['issue'] && payload['action'] && !payload['pull_request']) {
      const issue = payload['issue'] as Record<string, unknown>;
      const action = payload['action'] as string;
      const repo = (payload['repository'] as Record<string, unknown>)?.['full_name'] as string;

      let type: string;
      if (action === 'opened') type = GithubEventType.ISSUE_OPENED;
      else if (action === 'closed') type = GithubEventType.ISSUE_CLOSED;
      else if (action === 'reopened') type = GithubEventType.ISSUE_REOPENED;
      else return [];

      return [{
        ...base,
        type,
        actor: {
          id: (issue['user'] as Record<string, unknown>)?.['login'] as string ?? 'unknown',
          type: 'user' as const,
          displayName: (issue['user'] as Record<string, unknown>)?.['login'] as string,
        },
        subject: {
          id: String(issue['number']),
          type: 'issue',
          displayName: issue['title'] as string,
          url: issue['html_url'] as string,
        },
        payload: {
          repository: repo,
          issueNumber: issue['number'] as number,
          title: issue['title'] as string,
          body: issue['body'] as string | null,
          authorName: (issue['user'] as Record<string, unknown>)?.['login'] as string,
          state: issue['state'] as string,
          url: issue['html_url'] as string,
          labels: ((issue['labels'] as Array<Record<string, unknown>>) ?? []).map((l) => l['name'] as string),
        },
        raw: payload,
      }];
    }

    return [];
  }
}
