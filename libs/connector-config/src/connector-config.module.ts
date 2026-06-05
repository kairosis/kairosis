import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from './entities/workspace.entity';
import { ConnectorConfigEntity } from './entities/connector-config.entity';
import { SystemConfigEntity } from './entities/system-config.entity';
import { EventEntity } from './entities/event.entity';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ConnectorConfigService } from './connector-config.service';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity, ConnectorConfigEntity, SystemConfigEntity, EventEntity, ApiKeyEntity]),
  ],
  providers: [ConnectorConfigService, EventStoreService],
  exports:   [ConnectorConfigService, EventStoreService, TypeOrmModule],
})
export class ConnectorConfigModule {}
