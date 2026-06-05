import { DynamicModule, FactoryProvider, Module, ModuleMetadata } from '@nestjs/common';
import { KairosisConsumerOptions } from '@kairosis/consumer-sdk';
import { KairosisConsumerService } from './consumer.service';
import { KAIROSIS_CONSUMER_OPTIONS } from './consumer.tokens';

export interface KairosisConsumerAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: unknown[]) => KairosisConsumerOptions | Promise<KairosisConsumerOptions>;
  inject?: FactoryProvider['inject'];
}

@Module({})
export class KairosisConsumerModule {
  static forRoot(options: KairosisConsumerOptions = {}): DynamicModule {
    return {
      module:    KairosisConsumerModule,
      global:    true,
      providers: [
        { provide: KAIROSIS_CONSUMER_OPTIONS, useValue: options },
        KairosisConsumerService,
      ],
      exports: [KairosisConsumerService],
    };
  }

  static forRootAsync(asyncOptions: KairosisConsumerAsyncOptions): DynamicModule {
    return {
      module:  KairosisConsumerModule,
      global:  true,
      imports: asyncOptions.imports ?? [],
      providers: [
        {
          provide:    KAIROSIS_CONSUMER_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject:     asyncOptions.inject ?? [],
        },
        KairosisConsumerService,
      ],
      exports: [KairosisConsumerService],
    };
  }
}
