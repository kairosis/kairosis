import { Module } from '@nestjs/common';
import { ConnectorConfigModule } from '@kairosis/connector-config';
import { MessagingModule } from '@kairosis/messaging';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({
  imports:     [ConnectorConfigModule, MessagingModule, ApiKeysModule],
  controllers: [IngestController],
  providers:   [IngestService],
})
export class IngestModule {}
