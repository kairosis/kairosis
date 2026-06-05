import { Module } from '@nestjs/common';
import { ConnectorConfigModule } from '@kairosis/connector-config';
import { CryptoModule } from '@kairosis/crypto';
import { MessagingModule } from '@kairosis/messaging';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [ConnectorConfigModule, CryptoModule, MessagingModule],
  controllers: [WebhooksController],
  providers:   [WebhooksService],
})
export class WebhooksModule {}
