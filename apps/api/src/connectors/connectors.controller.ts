import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpCode } from '@nestjs/common';
import { ConnectorRegistry } from '@kairosis/connectors';
import { ConnectorsService } from './connectors.service';

@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Get()
  list() {
    return ConnectorRegistry.getAll().map((c) => c.manifest);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.connectorsService.getDetail(id);
  }

  @Get(':id/instances')
  listInstances(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.connectorsService.listInstances(id, workspaceId);
  }

  @Post(':id/instances')
  createInstance(
    @Param('id') id: string,
    @Body() body: {
      workspaceId: string;
      name?: string;
      enabled: boolean;
      config: Record<string, unknown>;
      secrets?: Record<string, unknown>;
    },
  ) {
    return this.connectorsService.createInstance(
      id,
      body.workspaceId,
      body.name,
      body.enabled,
      body.config ?? {},
      body.secrets,
    );
  }

  @Get(':id/instances/:instanceId')
  getInstance(
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.connectorsService.getInstance(id, instanceId);
  }

  @Patch(':id/instances/:instanceId')
  updateInstance(
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
    @Body() body: {
      name?: string;
      enabled: boolean;
      config: Record<string, unknown>;
      secrets?: Record<string, unknown>;
    },
  ) {
    return this.connectorsService.updateInstance(
      id,
      instanceId,
      body.name,
      body.enabled,
      body.config ?? {},
      body.secrets,
    );
  }

  @Delete(':id/instances/:instanceId')
  @HttpCode(200)
  deleteInstance(
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.connectorsService.deleteInstance(id, instanceId);
  }

  @Post(':id/instances/:instanceId/test')
  @HttpCode(200)
  testInstance(
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.connectorsService.testInstance(id, instanceId);
  }
}
