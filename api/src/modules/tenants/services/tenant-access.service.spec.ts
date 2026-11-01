import { ForbiddenException } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';

jest.mock('../../auth/rbac/rbac.service', () => ({ RbacService: class {} }));

const access = (over: Record<string, unknown>) => {
  const rbac = {
    getEffectivePermissions: jest.fn().mockResolvedValue({
      isSuperAdmin: false,
      roleId: null,
      permissions: [],
      ...over,
    }),
  };
  return new TenantAccessService(rbac as any);
};

describe('TenantAccessService', () => {
  it('rejects someone outside the tenant', async () => {
    await expect(access({}).assertMember('u', 't')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a member when no permission is needed', async () => {
    await expect(access({ roleId: 'r' }).assertMember('u', 't')).resolves.toBeUndefined();
  });

  it('rejects a member without the permission', async () => {
    await expect(
      access({ roleId: 'r', permissions: ['settings.view'] }).assertMember(
        'u',
        't',
        'settings.billing',
      ),
    ).rejects.toThrow('permission');
  });

  it('allows a member with the permission', async () => {
    await expect(
      access({ roleId: 'r', permissions: ['settings.billing'] }).assertMember(
        'u',
        't',
        'settings.billing',
      ),
    ).resolves.toBeUndefined();
  });

  it('lets platform admins through', async () => {
    await expect(
      access({ isSuperAdmin: true }).assertMember('u', 't', 'settings.billing'),
    ).resolves.toBeUndefined();
  });

  it('only lets platform admins pass the admin check', async () => {
    await expect(access({ roleId: 'r' }).assertSuperAdmin('u')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(access({ isSuperAdmin: true }).assertSuperAdmin('u')).resolves.toBeUndefined();
  });
});
