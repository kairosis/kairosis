import {
  Entity, PrimaryColumn, Column, Index,
} from 'typeorm';

@Entity('events')
@Index(['workspaceId', 'ingestedAt'])
export class EventEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'connector_id', type: 'text' })
  connectorId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ name: 'routing_key', type: 'text' })
  routingKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  actor!: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  subject!: unknown | null;

  @Column({ type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'ingested_at', type: 'timestamptz' })
  ingestedAt!: Date;
}
