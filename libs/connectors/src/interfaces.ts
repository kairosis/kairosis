import { ZodSchema } from 'zod';
import { NormalizedEvent } from '@kairosis/events-core';
import { ConnectorManifest } from './manifest';

export interface IKairosisConnector {
  manifest:       ConnectorManifest;
  configSchema(): ZodSchema;
  secretsSchema?(): ZodSchema;
  onInit?(config: unknown): Promise<void>;
  onDestroy?(): Promise<void>;
}

export interface WebhookVerifyParams {
  body:    Buffer;
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  secrets: unknown;
}

export interface IWebhookConnector extends IKairosisConnector {
  verifyWebhook(params: WebhookVerifyParams): Promise<boolean>;
  normalize(body: unknown, workspaceId: string, config: unknown): Promise<NormalizedEvent[]>;
  /** Return a response object to short-circuit normalization (e.g. Slack url_verification challenge). */
  challengeResponse?(body: unknown): Record<string, unknown> | null;
}

export interface PollResult {
  events: NormalizedEvent[];
  state?: unknown;
}

export interface IPollerConnector extends IKairosisConnector {
  poll(config: unknown, secrets: unknown, state: unknown, workspaceId: string): Promise<PollResult>;
}

export interface IDeviceConnector extends IKairosisConnector {
  normalize(body: unknown, workspaceId: string, config: unknown): Promise<NormalizedEvent[]>;
}

export interface IImportConnector extends IKairosisConnector {
  import(config: unknown, workspaceId: string): AsyncGenerator<NormalizedEvent[]>;
}

export interface ISyncConnector extends IImportConnector {
  export(events: NormalizedEvent[], config: unknown): Promise<void>;
  sync?(config: unknown, workspaceId: string): AsyncGenerator<NormalizedEvent[]>;
}
