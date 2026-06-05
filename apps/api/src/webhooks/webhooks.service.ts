import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConnectorRegistry, IWebhookConnector } from '@kairosis/connectors';
import { ConnectorConfigService } from '@kairosis/connector-config';
import { CryptoService } from '@kairosis/crypto';
import { MessagingService } from '@kairosis/messaging';
import { TenantContext } from '@kairosis/tenant';
import { NormalizedEventSchema } from '@kairosis/events-core';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly configService: ConnectorConfigService,
    private readonly cryptoService: CryptoService,
    private readonly messagingService: MessagingService,
  ) { }

  async handleWebhook(
    connectorId: string,
    webhookToken: string,
    body: unknown,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<Record<string, unknown>> {
    const config = await this.configService.findByWebhookToken(webhookToken);
    if (!config || config.connectorId !== connectorId) {
      throw new NotFoundException('Webhook not found');
    }
    if (!config.enabled) {
      throw new NotFoundException('Connector is disabled');
    }

    const connector = ConnectorRegistry.get(connectorId) as IWebhookConnector | undefined;
    if (!connector || typeof connector.verifyWebhook !== 'function') {
      throw new NotFoundException(`Connector '${connectorId}' not found or is not a webhook connector`);
    }

    const secrets = config.secrets
      ? JSON.parse(this.cryptoService.decrypt(config.secrets))
      : {};

    const valid = await connector.verifyWebhook({ body: rawBody, rawBody, headers, secrets });
    if (!valid) {
      throw new UnauthorizedException('Webhook signature verification failed');
    }

    if (typeof connector.challengeResponse === 'function') {
      const challenge = connector.challengeResponse(body);
      if (challenge !== null) return challenge;
    }

    const events = await TenantContext.run({ workspaceId: config.workspaceId }, async () => {
      return connector.normalize(body, config.workspaceId, config.config);
    });

    let published = 0;
    for (const raw of events) {
      const event = NormalizedEventSchema.parse(raw);
      await this.messagingService.publish(event);
      published++;
    }

    return { ok: true, published };
  }
}
