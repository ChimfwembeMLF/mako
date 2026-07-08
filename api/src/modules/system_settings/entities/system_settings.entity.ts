import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'system_settings' })
export class SystemSettings {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
