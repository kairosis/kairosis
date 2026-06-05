import {
  Controller, Post, Param, Body, Headers, Req, Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':connectorId/:webhookToken')
  async handleWebhook(
    @Param('connectorId') connectorId: string,
    @Param('webhookToken') webhookToken: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ) {
    const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(body));
    this.logger.log(`Webhook received: ${connectorId}`);
    return this.webhooksService.handleWebhook(connectorId, webhookToken, body, rawBody, headers);
  }
}
