import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { WorkspaceEntity } from './workspace.entity';

@Entity('connector_configs')
export class ConnectorConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => WorkspaceEntity, (w) => w.connectorConfigs)
  @JoinColumn({ name: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Column({ name: 'connector_id', type: 'text' })
  connectorId!: string;

  @Column({ name: 'instance_name', type: 'text', nullable: true })
  instanceName!: string | null;

  @Column({ default: false })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  config!: Record<string, unknown>;

  @Column({ type: 'bytea', nullable: true })
  secrets!: Buffer | null;

  @Column({ name: 'webhook_token', type: 'text', nullable: true, unique: true })
  webhookToken!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  state!: unknown | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
