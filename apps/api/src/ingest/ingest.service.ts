import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConnectorRegistry, IDeviceConnector } from '@kairosis/connectors';
import { ConnectorConfigService } from '@kairosis/connector-config';
import { MessagingService } from '@kairosis/messaging';
import { TenantContext } from '@kairosis/tenant';
import { NormalizedEventSchema } from '@kairosis/events-core';
import { ApiKeysService } from '../api-keys/api-keys.service';

@Injectable()
export class IngestService {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly configService: ConnectorConfigService,
    private readonly messagingService: MessagingService,
  ) {}

  async handleIngest(
    connectorId: string,
    authHeader: string | undefined,
    body: unknown,
  ): Promise<{ ok: boolean; published: number }> {
    const token = this.extractBearer(authHeader);
    if (!token) throw new UnauthorizedException('Missing or invalid Authorization header');

    const verified = await this.apiKeysService.verify(token);
    if (!verified) throw new UnauthorizedException('Invalid or revoked API key');

    if (verified.connectorId !== connectorId) {
      throw new ForbiddenException('API key is not authorized for this connector');
    }

    const connector = ConnectorRegistry.get(connectorId) as IDeviceConnector | undefined;
    if (!connector || connector.manifest.type !== 'device') {
      throw new NotFoundException(`Connector '${connectorId}' not found or does not support ingest`);
    }

    const configs = await this.configService.findAllByWorkspaceAndConnector(
      verified.workspaceId,
      connectorId,
    );
    const config = configs.find((c) => c.enabled);
    if (!config) throw new NotFoundException('No enabled instance found for this connector');

    const events = await TenantContext.run({ workspaceId: verified.workspaceId }, () =>
      connector.normalize(body, verified.workspaceId, config.config),
    );

    let published = 0;
    for (const raw of events) {
      const event = NormalizedEventSchema.parse(raw);
      await this.messagingService.publish(event);
      published++;
    }

    return { ok: true, published };
  }

  private extractBearer(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token || null;
  }
}
