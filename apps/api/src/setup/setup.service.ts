import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity, SystemConfigEntity, ConnectorConfigEntity } from '@kairosis/connector-config';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(SystemConfigEntity)
    private readonly systemConfigRepo: Repository<SystemConfigEntity>,
    @InjectRepository(ConnectorConfigEntity)
    private readonly connectorConfigRepo: Repository<ConnectorConfigEntity>,
  ) {}

  async getStatus(): Promise<{ setupComplete: boolean; workspaceId: string | null; hasActiveConnectors: boolean; activeInstanceCount: number }> {
    const config = await this.systemConfigRepo.findOne({ where: {} });
    const activeInstanceCount = config?.firstWorkspaceId
      ? await this.connectorConfigRepo.count({ where: { workspaceId: config.firstWorkspaceId, enabled: true } })
      : 0;
    return {
      setupComplete:       config?.setupComplete ?? false,
      workspaceId:         config?.firstWorkspaceId ?? null,
      hasActiveConnectors: activeInstanceCount > 0,
      activeInstanceCount,
    };
  }

  async completeSetup(workspaceName: string): Promise<{ workspaceId: string }> {
    const existing = await this.systemConfigRepo.findOne({ where: {} });
    if (existing?.setupComplete) {
      throw new Error('Setup already complete');
    }

    const workspace = this.workspaceRepo.create({
      name: workspaceName,
      displayName: workspaceName,
      setupComplete: true,
    });
    const saved = await this.workspaceRepo.save(workspace);

    const config = this.systemConfigRepo.create({
      setupComplete: true,
      firstWorkspaceId: saved.id,
    });
    await this.systemConfigRepo.save(config);

    return { workspaceId: saved.id };
  }
}
