import { Controller, Get, Post, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.apiKeysService.list(workspaceId);
  }

  @Post()
  create(
    @Body('workspaceId') workspaceId: string,
    @Body('connectorId') connectorId: string,
    @Body('name') name: string,
  ) {
    return this.apiKeysService.create(workspaceId, connectorId, name);
  }

  @Delete(':id')
  revoke(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.apiKeysService.revoke(id, workspaceId);
  }
}
