import { Module } from '@nestjs/common';
import { ConnectorConfigModule } from '@kairosis/connector-config';
import { CryptoModule } from '@kairosis/crypto';
import { OAuth2Controller } from './oauth2.controller';
import { OAuth2Service } from './oauth2.service';
import { TokenRefreshService } from './token-refresh.service';

@Module({
  imports:     [ConnectorConfigModule, CryptoModule],
  controllers: [OAuth2Controller],
  providers:   [OAuth2Service, TokenRefreshService],
  exports:     [OAuth2Service],
})
export class OAuth2Module {}
