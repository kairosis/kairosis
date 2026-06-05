import { Controller, Get, Param, Query, Redirect, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { OAuth2Service } from './oauth2.service';
import { isOAuth2Connector } from './types/oauth2.types';
import { ConnectorRegistry } from '@kairosis/connectors';
import { ConnectorConfigService } from '@kairosis/connector-config';

const DASHBOARD_URL = () => process.env['NEXT_PUBLIC_API_URL']
  ? process.env['NEXT_PUBLIC_API_URL'].replace(':3200', ':3001')
  : 'http://localhost:3001';

@Controller('oauth2')
export class OAuth2Controller {
  private readonly logger = new Logger(OAuth2Controller.name);

  constructor(
    private readonly oauth2Service: OAuth2Service,
    private readonly configService: ConnectorConfigService,
  ) {}

  /**
   * Initiate the OAuth2 flow.
   * GET /oauth2/connect/:connectorId?workspaceId=&instanceId=
   */
  @Get('connect/:connectorId')
  @Redirect()
  async connect(
    @Param('connectorId') connectorId: string,
    @Query('workspaceId') workspaceId: string,
    @Query('instanceId')  instanceId: string,
  ) {
    if (!workspaceId || !instanceId) {
      throw new BadRequestException('workspaceId and instanceId are required');
    }

    const connector = ConnectorRegistry.get(connectorId);
    if (!connector || !isOAuth2Connector(connector)) {
      throw new NotFoundException(`Connector '${connectorId}' does not support OAuth2`);
    }

    const config = await this.configService.findById(instanceId);
    if (!config || config.connectorId !== connectorId || config.workspaceId !== workspaceId) {
      throw new NotFoundException('Connector instance not found');
    }

    const url = this.oauth2Service.buildAuthUrl(
      connector.oauthProvider(),
      workspaceId,
      connectorId,
      instanceId,
    );

    return { url };
  }

  /**
   * OAuth2 provider redirects here after user authorization.
   * GET /oauth2/callback/:connectorId?code=&state=
   */
  @Get('callback/:connectorId')
  @Redirect()
  async callback(
    @Param('connectorId') connectorId: string,
    @Query('code')  code:  string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      this.logger.warn(`OAuth2 callback error for ${connectorId}: ${error}`);
      return { url: `${DASHBOARD_URL()}/connectors/${connectorId}?oauth_error=${encodeURIComponent(error)}` };
    }

    if (!code || !state) {
      throw new BadRequestException('code and state are required');
    }

    const connector = ConnectorRegistry.get(connectorId);
    if (!connector || !isOAuth2Connector(connector)) {
      throw new NotFoundException(`Connector '${connectorId}' does not support OAuth2`);
    }

    try {
      const { instanceId } = await this.oauth2Service.handleCallback(
        connector.oauthProvider(),
        code,
        state,
      );

      return { url: `${DASHBOARD_URL()}/connectors/${connectorId}/instances/${instanceId}?oauth_success=1` };
    } catch (err) {
      this.logger.error(`OAuth2 callback failed for ${connectorId}`, err);
      return { url: `${DASHBOARD_URL()}/connectors/${connectorId}?oauth_error=callback_failed` };
    }
  }
}
