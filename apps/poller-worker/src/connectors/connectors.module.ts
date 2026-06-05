import { Module, OnModuleInit } from '@nestjs/common';
import { ConnectorRegistry } from '@kairosis/connectors';
import { ImapConnector } from '@kairosis/connector-imap';
import { GoogleCalendarConnector } from '@kairosis/connector-google-calendar';
import { SpotifyConnector } from '@kairosis/connector-spotify';

@Module({})
export class ConnectorsModule implements OnModuleInit {
  onModuleInit() {
    ConnectorRegistry.register(new ImapConnector());
    ConnectorRegistry.register(new GoogleCalendarConnector());
    ConnectorRegistry.register(new SpotifyConnector());
  }
}
