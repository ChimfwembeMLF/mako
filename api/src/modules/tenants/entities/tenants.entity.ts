import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../user/user.entity';
import { IntegrationProvider } from './tenant-integration-config.entity';

@Entity({ name: 'tenants' })
export class Tenants {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  logoUrl?: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'jsonb', nullable: true })
  themeConfig?: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: IntegrationProvider,
    nullable: true,
  })
  preferredAiProvider?: IntegrationProvider | null;

  /** Read-aloud voice provider, chosen separately from the chat provider. */
  @Column({ name: 'preferred_tts_provider', type: 'text', nullable: true })
  preferredTtsProvider?: IntegrationProvider | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  adsBalance: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;
}
