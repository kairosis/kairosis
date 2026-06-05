export { KairosisConsumerModule } from './consumer.module';
export type { KairosisConsumerAsyncOptions } from './consumer.module';
export { KairosisConsumerService } from './consumer.service';
export { KAIROSIS_CONSUMER_OPTIONS } from './consumer.tokens';

export type { KairosisConsumerOptions } from '@kairosis/consumer-sdk';
export {
  ClaimCheckExpiredError,
  ClaimCheckFetchError,
  ClaimCheckTimeoutError,
  NormalizedEventSchema,
  ClaimCheckSchema,
  RoutingKey,
} from '@kairosis/consumer-sdk';
export type { NormalizedEvent, ClaimCheck, Actor, Subject } from '@kairosis/consumer-sdk';
