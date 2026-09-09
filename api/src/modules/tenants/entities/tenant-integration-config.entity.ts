import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Tenants } from './tenants.entity';

export enum IntegrationProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  MISTRAL = 'mistral',
}

@Entity({ name: 'tenant_integration_configs' })
@Unique(['tenantId', 'provider'])
export class TenantIntegrationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({
    type: 'varchar',
    enum: IntegrationProvider,
    nullable: false,
  })
  provider: IntegrationProvider;

  @Column({ name: 'encrypted_api_key', type: 'text', nullable: false })
  encryptedApiKey: string;

  @Column({ type: 'varchar', nullable: false })
  iv: string;

  @Column({ name: 'auth_tag', type: 'varchar', nullable: false })
  authTag: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Tenants, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;
}
