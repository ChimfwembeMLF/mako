import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspaces } from './workspaces.entity';

/** One automation cycle, kept so the Automations tab can show recent results. */
export type AutomationRun = {
  at: string;
  trigger: 'scheduled' | 'manual';
  status: 'success' | 'partial' | 'failed' | 'skipped';
  generated: number;
  message: string;
  /** The day the drafts were planned for. */
  targetDate?: string;
  contentIds?: string[];
};

@Entity({ name: 'workspace_automation_configs' })
export class WorkspaceAutomationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'text', default: 'Africa/Lusaka' })
  timezone: string;

  @Column({ name: 'generate_at', type: 'text', default: '19:00' })
  generateAt: string;

  @Column({ name: 'posts_per_cycle', type: 'int', default: 3 })
  postsPerCycle: number;

  @Column({ name: 'plan_ahead_days', type: 'int', default: 1 })
  planAheadDays: number;

  @Column({ name: 'publishing_days', type: 'jsonb', default: '[]' })
  publishingDays: string[];

  @Column({ name: 'posting_times', type: 'jsonb', default: '[]' })
  postingTimes: string[];

  @Column({ type: 'jsonb', default: '[]' })
  platforms: string[];

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt?: Date | null;

  @Column({ name: 'recent_runs', type: 'jsonb', default: '[]' })
  recentRuns: AutomationRun[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Workspaces, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspaces;
}
