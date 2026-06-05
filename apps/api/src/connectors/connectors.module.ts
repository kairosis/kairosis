import { Module, OnModuleInit } from '@nestjs/common';
import { ConnectorRegistry } from '@kairosis/connectors';
import { GithubConnector } from '@kairosis/connector-github';
import { SlackConnector } from '@kairosis/connector-slack';
import { ImapConnector } from '@kairosis/connector-imap';
import { GoogleCalendarConnector } from '@kairosis/connector-google-calendar';
import { TerminalConnector } from '@kairosis/connector-terminal';
import { BrowserConnector } from '@kairosis/connector-browser';
import { DesktopConnector } from '@kairosis/connector-desktop';
import { SpotifyConnector } from '@kairosis/connector-spotify';
import { ConnectorConfigModule } from '@kairosis/connector-config';
import { CryptoModule } from '@kairosis/crypto';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [ConnectorConfigModule, CryptoModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
})
export class ConnectorsModule implements OnModuleInit {
  onModuleInit() {
    ConnectorRegistry.register(new GithubConnector());
    ConnectorRegistry.register(new SlackConnector());
    ConnectorRegistry.register(new ImapConnector());
    ConnectorRegistry.register(new GoogleCalendarConnector());
    ConnectorRegistry.register(new TerminalConnector());
    ConnectorRegistry.register(new BrowserConnector());
    ConnectorRegistry.register(new DesktopConnector());
    ConnectorRegistry.register(new SpotifyConnector());
  }
}
