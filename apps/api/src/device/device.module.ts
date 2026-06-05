import { Module } from '@nestjs/common';
import { ConnectorConfigModule } from '@kairosis/connector-config';
import { MessagingModule } from '@kairosis/messaging';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  imports:     [ConnectorConfigModule, MessagingModule],
  controllers: [DeviceController],
  providers:   [DeviceService],
})
export class DeviceModule {}
