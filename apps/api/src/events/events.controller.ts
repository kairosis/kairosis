import { Controller, Get, Sse, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessagingService } from '@kairosis/messaging';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly eventsService: EventsService,
  ) {}

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.findByWorkspace(workspaceId, limit ? parseInt(limit, 10) : 100);
  }

  @Get('count-today')
  async countToday(@Query('workspaceId') workspaceId: string) {
    return { count: await this.eventsService.countToday(workspaceId) };
  }

  @Get('stats')
  async stats(
    @Query('workspaceId') workspaceId: string,
    @Query('connectorId') connectorId: string,
  ) {
    return this.eventsService.statsForConnector(workspaceId, connectorId);
  }

  @Sse('stream')
  stream(@Query('workspaceId') workspaceId: string): Observable<MessageEvent> {
    return this.messagingService.createEventStream(workspaceId);
  }
}
