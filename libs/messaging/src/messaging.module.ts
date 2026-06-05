import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagingService } from './messaging.service';
import { StorageService } from './storage.service';

@Module({
  imports:   [EventEmitterModule.forRoot()],
  providers: [StorageService, MessagingService],
  exports:   [MessagingService],
})
export class MessagingModule {}
