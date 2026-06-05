import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { EventEntity } from '@kairosis/connector-config';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly repo: Repository<EventEntity>,
  ) {}

  async findByWorkspace(workspaceId: string, limit = 100): Promise<EventEntity[]> {
    return this.repo.find({
      where: { workspaceId },
      order: { ingestedAt: 'DESC' },
      take: limit,
    });
  }

  async countToday(workspaceId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.repo.count({
      where: { workspaceId, ingestedAt: MoreThanOrEqual(startOfDay) },
    });
  }

  async statsForConnector(workspaceId: string, connectorId: string): Promise<{ total: number; lastEventAt: string | null }> {
    const total = await this.repo.count({ where: { workspaceId, connectorId } });
    const last = await this.repo.findOne({
      where: { workspaceId, connectorId },
      order: { ingestedAt: 'DESC' },
      select: ['ingestedAt'],
    });
    return { total, lastEventAt: last?.ingestedAt.toISOString() ?? null };
  }
}
