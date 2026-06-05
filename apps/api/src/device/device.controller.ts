import { Controller, Post, Param, Body } from '@nestjs/common';
import { DeviceService } from './device.service';

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post(':connectorId/:deviceToken')
  handleEvent(
    @Param('connectorId') connectorId: string,
    @Param('deviceToken') deviceToken: string,
    @Body() body: unknown,
  ) {
    return this.deviceService.handleEvent(connectorId, deviceToken, body);
  }
}
