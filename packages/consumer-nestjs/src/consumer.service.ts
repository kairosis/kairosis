import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { KairosisConsumer, KairosisConsumerOptions } from '@kairosis/consumer-sdk';
import { NormalizedEvent } from '@kairosis/events-core';
import { KAIROSIS_CONSUMER_OPTIONS } from './consumer.tokens';

@Injectable()
export class KairosisConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KairosisConsumerService.name);
  private readonly consumer: KairosisConsumer;

  constructor(
    @Inject(KAIROSIS_CONSUMER_OPTIONS)
    private readonly options: KairosisConsumerOptions,
  ) {
    this.consumer = new KairosisConsumer(options);
  }

  onApplicationBootstrap(): void {
    this.logger.log(
      `Ready — cache: ${this.options.cache ?? true}, timeout: ${this.options.timeout ?? 5000}ms`,
    );
  }

  /** Parse raw data (Buffer, string, or object) into a validated NormalizedEvent. */
  parse(raw: unknown): NormalizedEvent {
    return this.consumer.parse(raw);
  }

  /** True if the event payload was offloaded via claim-check. */
  isClaimChecked(event: NormalizedEvent): boolean {
    return this.consumer.isClaimChecked(event);
  }

  /**
   * Resolve a (potentially claim-checked) event to its full form.
   * Cache hits are returned instantly. Cache is shared for the lifetime
   * of the NestJS application.
   */
  resolve(event: NormalizedEvent): Promise<NormalizedEvent> {
    return this.consumer.resolve(event);
  }

  /** Evict all cached claim-check payloads. */
  clearCache(): void {
    this.consumer.clearCache();
  }

  /** Number of payloads currently held in the claim-check cache. */
  get cacheSize(): number {
    return this.consumer.cacheSize;
  }
}
