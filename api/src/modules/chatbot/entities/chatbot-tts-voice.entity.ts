import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'chatbot_tts_voices' })
export class ChatbotTtsVoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64 })
  mistralVoiceId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
