import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('api_keys')
@Index(['workspaceId'])
@Index(['keyHash'], { unique: true })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'connector_id', type: 'text' })
  connectorId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'key_hash', type: 'text', unique: true })
  keyHash!: string;

  /** First 12 characters of the raw key — safe to display, not enough to reconstruct */
  @Column({ name: 'key_prefix', type: 'text' })
  keyPrefix!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
