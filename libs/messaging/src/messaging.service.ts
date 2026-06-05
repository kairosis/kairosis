import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import * as amqplib from 'amqplib';
import { NormalizedEvent, NormalizedEventSchema } from '@kairosis/events-core';
import { StorageService } from './storage.service';

@Injectable()
export class MessagingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MessagingService.name);
  private channel!: amqplib.Channel;
  private connection!: amqplib.ChannelModel;
  private readonly exchange = process.env['RABBITMQ_EXCHANGE'] ?? 'kairosis.topic';

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const url = process.env['RABBITMQ_URL'];
    if (!url) throw new Error('RABBITMQ_URL env var is not set');

    try {
      this.connection = await amqplib.connect(url);
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ — crashing', err);
      process.exit(1);
    }

    this.connection.on('error', (err) => {
      this.logger.error('RabbitMQ connection error — crashing', err);
      process.exit(1);
    });

    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    this.logger.log(`Connected to RabbitMQ exchange: ${this.exchange}`);
  }

  async publish(event: NormalizedEvent): Promise<void> {
    const validated = NormalizedEventSchema.parse(event);
    const routingKey = validated.type;
    const message = await this.applyClaimCheck(validated);
    this.logger.log(`Publishing event to ${routingKey}${message.claimCheck ? ' (claim-check)' : ''}`);
    const content = Buffer.from(JSON.stringify(message));
    this.channel.publish(this.exchange, routingKey, content, { persistent: true });
    this.eventEmitter.emit('event.published', validated);
  }

  private async applyClaimCheck(event: NormalizedEvent): Promise<NormalizedEvent> {
    const threshold = parseInt(process.env['CLAIMCHECK_THRESHOLD_BYTES'] ?? '131072');
    const serialized = JSON.stringify(event);

    if (!this.storageService.isEnabled() || serialized.length <= threshold) {
      return event;
    }

    const expirySeconds = parseInt(process.env['CLAIMCHECK_URL_EXPIRY_SECONDS'] ?? '60');
    const objectKey = `claim-checks/${event.workspaceId}/${event.id}.json`;

    await this.storageService.upload(objectKey, serialized);
    const url = await this.storageService.presignedGetUrl(objectKey, expirySeconds);
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    return {
      ...event,
      payload: {},
      raw:     undefined,
      claimCheck: { objectKey, url, expiresAt },
    };
  }

  createEventStream(workspaceId: string): Observable<MessageEvent> {
    const events$ = new Observable<MessageEvent>((observer) => {
      let consumerTag: string | undefined;
      let consumerChannel: amqplib.Channel | undefined;

      const setup = async () => {
        consumerChannel = await this.connection.createChannel();
        const q = await consumerChannel.assertQueue('', { exclusive: true, autoDelete: true });
        await consumerChannel.bindQueue(q.queue, this.exchange, '#');

        const { consumerTag: tag } = await consumerChannel.consume(q.queue, (msg) => {
          if (!msg) return;
          try {
            const event = JSON.parse(msg.content.toString()) as NormalizedEvent;
            if (event.workspaceId === workspaceId) {
              observer.next({ data: event } as unknown as MessageEvent);
            }
            consumerChannel?.ack(msg);
          } catch {
            consumerChannel?.ack(msg!);
          }
        });

        consumerTag = tag;
      };

      setup().catch((err) => observer.error(err));

      return () => {
        if (consumerChannel && consumerTag) {
          consumerChannel.cancel(consumerTag).catch(() => {});
          consumerChannel.close().catch(() => {});
        }
      };
    });

    // Heartbeat every 15 s — keeps the SSE connection alive through proxies and browsers
    const heartbeat$ = interval(15_000).pipe(
      map(() => ({ data: { __heartbeat__: true } } as unknown as MessageEvent)),
    );

    return merge(events$, heartbeat$);
  }
}
