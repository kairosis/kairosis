import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConnectorConfigService } from '@kairosis/connector-config';
import { ConnectorRegistry } from '@kairosis/connectors';
import { isOAuth2Connector } from './types/oauth2.types';
import { OAuth2Service } from './oauth2.service';

@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  constructor(
    private readonly oauth2Service: OAuth2Service,
    private readonly configService: ConnectorConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshExpiring(): Promise<void> {
    const configs = await this.configService.findEnabledPollers();

    for (const config of configs) {
      const connector = ConnectorRegistry.get(config.connectorId);
      if (!connector || !isOAuth2Connector(connector)) continue;

      try {
        const tokens = await this.oauth2Service.loadTokens(config.id);
        if (!tokens) continue;

        if (this.oauth2Service.isExpiringSoon(tokens, 10 * 60_000)) {
          this.logger.log(`Refreshing token for ${config.connectorId} / ${config.id}`);
          const provider = connector.oauthProvider();
          await this.oauth2Service.refreshToken(provider, config.workspaceId, config.connectorId, config.id);
        }
      } catch (err) {
        this.logger.error(
          `Failed to refresh token for ${config.connectorId} / ${config.id}`,
          err,
        );
      }
    }
  }
}
