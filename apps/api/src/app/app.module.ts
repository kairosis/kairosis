import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OAuth2Module } from '@kairosis/oauth2';
import {
  WorkspaceEntity,
  ConnectorConfigEntity,
  SystemConfigEntity,
  EventEntity,
  ApiKeyEntity,
  ConnectorConfigModule,
} from '@kairosis/connector-config';
import { CryptoModule } from '@kairosis/crypto';
import { MessagingModule } from '@kairosis/messaging';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SetupModule } from '../setup/setup.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { EventsModule } from '../events/events.module';
import { DeviceModule } from '../device/device.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type:     'postgres',
      host:     process.env['POSTGRES_HOST']     ?? 'localhost',
      port:     parseInt(process.env['POSTGRES_PORT']  ?? '5432'),
      database: process.env['POSTGRES_DB']       ?? 'kairosis',
      username: process.env['POSTGRES_USER']     ?? 'kairosis',
      password: process.env['POSTGRES_PASSWORD'] ?? '',
      entities: [WorkspaceEntity, ConnectorConfigEntity, SystemConfigEntity, EventEntity, ApiKeyEntity],
      synchronize: process.env['NODE_ENV'] !== 'production',
      logging: false,
    }),
    ScheduleModule.forRoot(),
    ConnectorConfigModule,
    CryptoModule,
    MessagingModule,
    ConnectorsModule,
    SetupModule,
    WebhooksModule,
    EventsModule,
    DeviceModule,
    ApiKeysModule,
    IngestModule,
    OAuth2Module,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
