import { Controller, Post, Param, Body, Headers } from '@nestjs/common';
import { IngestService } from './ingest.service';

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post(':connectorId')
  handle(
    @Param('connectorId') connectorId: string,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: unknown,
  ) {
    return this.ingestService.handleIngest(connectorId, authHeader, body);
  }
}
