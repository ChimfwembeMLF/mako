import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'permissions' })
export class Permissions {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  module?: string;
}
