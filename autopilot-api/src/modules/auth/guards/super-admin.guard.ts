import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../user/user.entity';
import { Profiles } from '../../profiles/entities/profiles.entity';
import { RoleType } from '../../../constants';

/** Platform backoffice — Super Admin only */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(Profiles)
    private readonly profilesRepo: Repository<Profiles>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = String(req.user?.sub ?? '');
    if (!userId) throw new ForbiddenException('Authentication required');

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    const profile = await this.profilesRepo.findOne({ where: { userId } });
    const isSuperAdmin =
      user?.role === RoleType.SUPER_ADMIN || profile?.isSystemAdmin === true;

    if (!isSuperAdmin)
      throw new ForbiddenException('Super Admin access required');
    return true;
  }
}
