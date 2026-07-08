import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { ContentItems } from './content_items.entity';
import { UserEntity } from '../../user/user.entity';

@Index(['contentId'])
@Entity({ name: 'media_assets' })
export class MediaAssets {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'uuid', nullable: true })
  contentId?: string;

  @Column({ type: 'text' })
  mediaUrl: string;

  @Column({ type: 'text', default: 'image' })
  mediaType: string;

  @Column({ type: 'text', nullable: true })
  name?: string;

  @Column({ type: 'text', array: true, nullable: true })
  tags?: string[];

  @Column({ type: 'uuid', nullable: true })
  uploadedBy?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes?: string;

  @Column({ type: 'int', nullable: true })
  widthPx?: number;

  @Column({ type: 'int', nullable: true })
  heightPx?: number;

  @Column({ type: 'text', nullable: true })
  altText?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Tenants, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenants;

  @ManyToOne(() => ContentItems, { nullable: true })
  @JoinColumn({ name: 'content_id' })
  content?: ContentItems;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: UserEntity;
}
