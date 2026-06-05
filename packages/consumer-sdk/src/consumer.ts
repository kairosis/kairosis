import { NormalizedEvent, NormalizedEventSchema } from '@kairosis/events-core';
import { ClaimCheckExpiredError, ClaimCheckFetchError, ClaimCheckTimeoutError } from './errors';

export interface KairosisConsumerOptions {
  /** Cache resolved claim-check payloads by objectKey. Default: true. */
  cache?: boolean;
  /** Fetch timeout in milliseconds for claim-check resolution. Default: 5000. */
  timeout?: number;
}

export class KairosisConsumer {
  private readonly useCache: boolean;
  private readonly timeout: number;
  private readonly _cache: Map<string, NormalizedEvent> = new Map();

  constructor(options: KairosisConsumerOptions = {}) {
    this.useCache = options.cache ?? true;
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Parse raw event data into a validated NormalizedEvent.
   *
   * Accepts a plain object, JSON string, or Uint8Array / Buffer
   * (the typical content type of a RabbitMQ message in Node).
   *
   * Throws ZodError if the data does not match the schema.
   */
  parse(raw: unknown): NormalizedEvent {
    if (raw instanceof Uint8Array) {
      return NormalizedEventSchema.parse(JSON.parse(new TextDecoder().decode(raw)));
    }
    if (typeof raw === 'string') {
      return NormalizedEventSchema.parse(JSON.parse(raw));
    }
    return NormalizedEventSchema.parse(raw);
  }

  /**
   * Returns true if the event payload was offloaded to object storage.
   * The payload field of such events is empty ({}) until resolved.
   */
  isClaimChecked(event: NormalizedEvent): boolean {
    return !!event.claimCheck;
  }

  /**
   * Resolve a (potentially claim-checked) event to its full form.
   *
   * - No claimCheck present → returned as-is.
   * - Cache hit on objectKey → cached full event returned immediately.
   * - Otherwise: fetches the presigned URL (with timeout), parses and
   *   validates the response, caches if cache:true, returns full event.
   *
   * Throws:
   *   ClaimCheckExpiredError  — presigned URL has passed its expiresAt
   *   ClaimCheckFetchError    — non-2xx response from object storage
   *   ClaimCheckTimeoutError  — fetch exceeded the configured timeout
   */
  async resolve(event: NormalizedEvent): Promise<NormalizedEvent> {
    if (!event.claimCheck) return event;

    const { url, expiresAt, objectKey } = event.claimCheck;

    if (this.useCache) {
      const cached = this._cache.get(objectKey);
      if (cached) return cached;
    }

    if (new Date(expiresAt) <= new Date()) {
      throw new ClaimCheckExpiredError(expiresAt, objectKey);
    }

    const full = await this._fetchWithTimeout(url, objectKey);

    if (this.useCache) {
      this._cache.set(objectKey, full);
    }

    return full;
  }

  /** Remove all cached claim-check payloads. */
  clearCache(): void {
    this._cache.clear();
  }

  /** Number of payloads currently in the cache. */
  get cacheSize(): number {
    return this._cache.size;
  }

  private async _fetchWithTimeout(url: string, objectKey: string): Promise<NormalizedEvent> {
    const fetchFn = this._getFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetchFn(url, { signal: controller.signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ClaimCheckTimeoutError(this.timeout, objectKey);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ClaimCheckFetchError(response.status, response.statusText, objectKey);
    }

    return NormalizedEventSchema.parse(await response.json());
  }

  private _getFetch(): typeof fetch {
    const f = typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch.bind(globalThis)
      : undefined;
    if (!f) {
      throw new Error(
        '[consumer-sdk] fetch is not available. Use Node 18+ or provide a fetch polyfill.',
      );
    }
    return f;
  }
}
