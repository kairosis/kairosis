import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NormalizedEvent } from '@kairosis/events-core';
import { EventEntity } from './entities/event.entity';

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly repo: Repository<EventEntity>,
  ) {}

  @OnEvent('event.published')
  async onEventPublished(event: NormalizedEvent): Promise<void> {
    this.logger.log(`Storing event (${event.type}) from ${event.connectorId}: ${event.id}`);
    await this.save(event);
  }

  async save(event: NormalizedEvent): Promise<void> {
    const entity = this.repo.create({
      id:          event.id,
      workspaceId: event.workspaceId,
      connectorId: event.connectorId,
      type:        event.type,
      routingKey:  event.type,
      actor:       event.actor ?? null,
      subject:     event.subject ?? null,
      payload:     event.payload,
      occurredAt:  new Date(event.occurredAt),
      ingestedAt:  new Date(event.ingestedAt),
    });
    await this.repo.save(entity);
  }
}
