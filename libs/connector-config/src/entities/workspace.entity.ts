import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ConnectorConfigEntity } from './connector-config.entity';

@Entity('workspaces')
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  displayName!: string;

  @Column({ default: false })
  setupComplete!: boolean;

  @OneToMany(() => ConnectorConfigEntity, (cc) => cc.workspace)
  connectorConfigs!: ConnectorConfigEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
