import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../common/abstract.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'device_push_tokens' })
export class DevicePushTokenEntity extends AbstractEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'token', type: 'varchar' })
  token: string;

  @Column({ name: 'device_name', type: 'varchar', nullable: true })
  deviceName?: string;

  @Column({ name: 'platform', type: 'varchar', nullable: true })
  platform?: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
