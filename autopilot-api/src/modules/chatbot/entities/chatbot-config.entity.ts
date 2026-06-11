import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'chatbot_configs' })
export class ChatbotConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  brandProfileId?: string;

  @Column({ type: 'varchar', length: 120, default: 'Website Assistant' })
  name: string;

  @Column({ type: 'text', nullable: true })
  welcomeMessage?: string;

  @Column({ type: 'text', nullable: true })
  systemPromptExtra?: string;

  @Column({ type: 'varchar', length: 64, default: 'mistral-small-latest' })
  model: string;

  @Column({ type: 'real', default: 0.3 })
  temperature: number;

  @Column({ type: 'int', default: 20 })
  maxContextMessages: number;

  @Column({ type: 'boolean', default: true })
  ragEnabled: boolean;

  @Column({ type: 'int', default: 6 })
  ragTopK: number;

  @Column({ type: 'real', default: 0.72 })
  ragMinScore: number;

  @Column({ type: 'boolean', default: false })
  widgetEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  widgetTheme?: Record<string, unknown>;

  @Column({ type: 'text', array: true, nullable: true })
  allowedOrigins?: string[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Opt-in: Mistral hosts document indexing/search via Libraries + Agents API */
  @Column({ type: 'boolean', default: false })
  useMistralLibrary: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mistralLibraryId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mistralAgentId?: string;

  @Column({ type: 'boolean', default: false })
  widgetTtsEnabled: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mistralVoiceId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
