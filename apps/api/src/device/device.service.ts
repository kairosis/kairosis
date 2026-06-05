import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConnectorRegistry, IDeviceConnector } from '@kairosis/connectors';
import { ConnectorConfigService } from '@kairosis/connector-config';
import { MessagingService } from '@kairosis/messaging';
import { TenantContext } from '@kairosis/tenant';
import { NormalizedEventSchema } from '@kairosis/events-core';

@Injectable()
export class DeviceService {
  constructor(
    private readonly configService: ConnectorConfigService,
    private readonly messagingService: MessagingService,
  ) {}

  async handleEvent(
    connectorId: string,
    deviceToken: string,
    body: unknown,
  ): Promise<{ ok: boolean; published: number }> {
    const config = await this.configService.findByWebhookToken(deviceToken);
    if (!config || config.connectorId !== connectorId) {
      throw new NotFoundException('Device endpoint not found');
    }
    if (!config.enabled) {
      throw new NotFoundException('Connector is disabled');
    }

    const connector = ConnectorRegistry.get(connectorId) as IDeviceConnector | undefined;
    if (!connector || connector.manifest.type !== 'device') {
      throw new NotFoundException(`Device connector '${connectorId}' not found`);
    }

    const events = await TenantContext.run({ workspaceId: config.workspaceId }, () =>
      connector.normalize(body, config.workspaceId, config.config),
    );

    let published = 0;
    for (const raw of events) {
      try {
        const event = NormalizedEventSchema.parse(raw);
        await this.messagingService.publish(event);
        published++;
      } catch {
        throw new UnprocessableEntityException('Event normalization produced an invalid event');
      }
    }

    return { ok: true, published };
  }
}
