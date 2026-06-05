import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectorConfigEntity } from './entities/connector-config.entity';
import { WorkspaceEntity } from './entities/workspace.entity';

@Injectable()
export class ConnectorConfigService {
  constructor(
    @InjectRepository(ConnectorConfigEntity)
    private readonly configRepo: Repository<ConnectorConfigEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
  ) {}

  findByWebhookToken(token: string): Promise<ConnectorConfigEntity | null> {
    return this.configRepo.findOne({ where: { webhookToken: token } });
  }

  findById(id: string): Promise<ConnectorConfigEntity | null> {
    return this.configRepo.findOne({ where: { id } });
  }

  findAllByWorkspaceAndConnector(workspaceId: string, connectorId: string): Promise<ConnectorConfigEntity[]> {
    return this.configRepo.find({ where: { workspaceId, connectorId }, order: { createdAt: 'ASC' } });
  }

  findEnabledPollers(): Promise<ConnectorConfigEntity[]> {
    return this.configRepo.find({ where: { enabled: true } });
  }

  create(workspaceId: string, connectorId: string, data: Partial<ConnectorConfigEntity>): Promise<ConnectorConfigEntity> {
    const entity = this.configRepo.create({ workspaceId, connectorId, ...data });
    return this.configRepo.save(entity);
  }

  async update(id: string, data: Partial<ConnectorConfigEntity>): Promise<ConnectorConfigEntity> {
    await this.configRepo.update(id, data);
    return this.configRepo.findOneOrFail({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.configRepo.delete(id);
  }
}
