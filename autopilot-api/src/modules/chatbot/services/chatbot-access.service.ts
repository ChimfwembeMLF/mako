import { ForbiddenException, Injectable } from '@nestjs/common';
import { RbacService } from '../../auth/rbac/rbac.service';

@Injectable()
export class ChatbotAccessService {
  constructor(private readonly rbac: RbacService) {}

  async assertPermission(userId: string, tenantId: string, permission: string): Promise<void> {
    const allowed = await this.rbac.hasPermission(userId, tenantId, permission);
    if (!allowed) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }
}
