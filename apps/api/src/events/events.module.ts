import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from '@kairosis/connector-config';
import { MessagingModule } from '@kairosis/messaging';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [MessagingModule, TypeOrmModule.forFeature([EventEntity])],
  controllers: [EventsController],
  providers:   [EventsService],
  exports:     [EventsService],
})
export class EventsModule {}
