import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'chatbot_api_keys' })
export class ChatbotApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  configId: string;

  @Column({ type: 'varchar', length: 32 })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 128 })
  keyHash: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
