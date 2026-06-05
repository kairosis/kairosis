import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { ApiKeyEntity } from '@kairosis/connector-config';

export interface CreatedApiKey {
  id: string;
  key: string;
  keyPrefix: string;
  connectorId: string;
  name: string;
  createdAt: Date;
}

export interface ApiKeyMeta {
  id: string;
  workspaceId: string;
  connectorId: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface VerifiedApiKey {
  workspaceId: string;
  connectorId: string;
  keyId: string;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
  ) {}

  async create(workspaceId: string, connectorId: string, name: string): Promise<CreatedApiKey> {
    const raw = `krs_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const keyPrefix = raw.slice(0, 12);

    const entity = this.repo.create({ workspaceId, connectorId, name, keyHash, keyPrefix });
    const saved = await this.repo.save(entity);

    return {
      id:          saved.id,
      key:         raw,
      keyPrefix,
      connectorId: saved.connectorId,
      name:        saved.name,
      createdAt:   saved.createdAt,
    };
  }

  async list(workspaceId: string): Promise<ApiKeyMeta[]> {
    const rows = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return rows.map(this.toMeta);
  }

  async revoke(id: string, workspaceId: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id, workspaceId, revokedAt: IsNull() } });
    if (!key) throw new NotFoundException('API key not found');
    key.revokedAt = new Date();
    await this.repo.save(key);
  }

  async verify(rawKey: string): Promise<VerifiedApiKey | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const key = await this.repo.findOne({ where: { keyHash, revokedAt: IsNull() } });
    if (!key) return null;

    key.lastUsedAt = new Date();
    await this.repo.save(key);

    return { workspaceId: key.workspaceId, connectorId: key.connectorId, keyId: key.id };
  }

  private toMeta(k: ApiKeyEntity): ApiKeyMeta {
    return {
      id:          k.id,
      workspaceId: k.workspaceId,
      connectorId: k.connectorId,
      name:        k.name,
      keyPrefix:   k.keyPrefix,
      createdAt:   k.createdAt,
      lastUsedAt:  k.lastUsedAt,
      revokedAt:   k.revokedAt,
    };
  }
}
