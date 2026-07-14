import type {
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber } from 'typeorm';

import { generateHash } from '../common/utils';
import { UserEntity } from '../modules/user/user.entity';

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<UserEntity> {
  listenTo(): typeof UserEntity {
    return UserEntity;
  }

  beforeInsert(event: InsertEvent<UserEntity>): void {
    if (event.entity.password) {
      event.entity.password = generateHash(event.entity.password);
    }
  }

  beforeUpdate(event: UpdateEvent<UserEntity>): void {
    const entity = event.entity as Partial<UserEntity>;
    // Partial updates (e.g. Google OAuth tokens) omit password — skip hashing.
    if (entity.password === undefined) {
      return;
    }

    const previous = event.databaseEntity?.password;
    if (previous == null) {
      entity.password = generateHash(entity.password);
      return;
    }

    if (entity.password !== previous) {
      entity.password = generateHash(entity.password);
    }
  }
}
