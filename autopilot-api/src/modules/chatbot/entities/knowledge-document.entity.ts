import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type KnowledgeDocumentStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed';

@Entity({ name: 'knowledge_documents' })
export class KnowledgeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string;

  @Column({ type: 'uuid' })
  uploadedBy: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 32, default: 'upload' })
  sourceType: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mimeType?: string;

  @Column({ type: 'text', nullable: true })
  storageUrl?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes?: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: KnowledgeDocumentStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
