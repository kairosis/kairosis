import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity, SystemConfigEntity, ConnectorConfigEntity } from '@kairosis/connector-config';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity, SystemConfigEntity, ConnectorConfigEntity])],
  controllers: [SetupController],
  providers:   [SetupService],
})
export class SetupModule {}
