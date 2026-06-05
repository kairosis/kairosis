import { Module } from '@nestjs/common';
import { ConnectorConfigModule } from '@kairosis/connector-config';
import { CryptoModule } from '@kairosis/crypto';
import { MessagingModule } from '@kairosis/messaging';
import { PollerScheduler } from './poller.scheduler';

@Module({
  imports:   [ConnectorConfigModule, CryptoModule, MessagingModule],
  providers: [PollerScheduler],
})
export class PollerModule {}
