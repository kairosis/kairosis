import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkspaceEntity,
  ConnectorConfigEntity,
  SystemConfigEntity,
  EventEntity,
  ConnectorConfigModule,
} from '@kairosis/connector-config';
import { CryptoModule } from '@kairosis/crypto';
import { MessagingModule } from '@kairosis/messaging';
import { ConnectorsModule } from '../connectors/connectors.module';
import { PollerModule } from '../poller/poller.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env['POSTGRES_HOST'] ?? 'localhost',
      port: parseInt(process.env['POSTGRES_PORT'] ?? '5432'),
      database: process.env['POSTGRES_DB'] ?? 'kairosis',
      username: process.env['POSTGRES_USER'] ?? 'kairosis',
      password: process.env['POSTGRES_PASSWORD'] ?? 'kairosis_dev',
      entities: [WorkspaceEntity, ConnectorConfigEntity, SystemConfigEntity, EventEntity],
      synchronize: process.env['NODE_ENV'] !== 'production',
      logging: false,
    }),
    ConnectorConfigModule,
    CryptoModule,
    MessagingModule,
    ConnectorsModule,
    PollerModule,
  ],
})
export class AppModule { }
