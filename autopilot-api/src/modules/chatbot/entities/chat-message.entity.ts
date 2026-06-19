import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface ChatCitation {
  documentId: string;
  chunkId?: string;
  title: string;
  excerpt: string;
}

@Entity({ name: 'chat_messages' })
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  citations?: ChatCitation[];

  @Column({ type: 'int', nullable: true })
  tokensUsed?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model?: string;

  @Column({ type: 'int', nullable: true })
  latencyMs?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
