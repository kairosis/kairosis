import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post()
  async completeSetup(@Body() body: { workspaceName: string }) {
    if (!body.workspaceName?.trim()) {
      throw new BadRequestException('workspaceName is required');
    }
    return this.setupService.completeSetup(body.workspaceName.trim());
  }
}
