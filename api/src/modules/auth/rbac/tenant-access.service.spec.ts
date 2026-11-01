import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';

jest.mock('./rbac.service', () => ({ RbacService: class {} }));

const setup = (over: Record<string, unknown> = {}, role: unknown = { tenantId: 't' }) => {
  const rbac = {
    getEffectivePermissions: jest.fn().mockResolvedValue({
      isSuperAdmin: false,
      roleId: null,
      permissions: [],
      ...over,
    }),
    isSuperAdmin: jest.fn().mockResolvedValue(Boolean(over.isSuperAdmin)),
    sharesTenant: jest.fn().mockResolvedValue(Boolean(over.shares)),
  };
  const roles = { findOne: jest.fn().mockResolvedValue(role) };
  return new TenantAccessService(rbac as any, roles as any);
};

describe('TenantAccessService', () => {
  it('rejects someone outside the tenant', async () => {
    await expect(setup().assertMember('u', 't')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a member when no permission is needed', async () => {
    await expect(setup({ roleId: 'r' }).assertMember('u', 't')).resolves.toBeUndefined();
  });

  it('rejects a member without the permission', async () => {
    await expect(
      setup({ roleId: 'r', permissions: ['settings.view'] }).assertMember('u', 't', 'settings.billing'),
    ).rejects.toThrow('permission');
  });

  it('allows a member with the permission', async () => {
    await expect(
      setup({ roleId: 'r', permissions: ['settings.billing'] }).assertMember('u', 't', 'settings.billing'),
    ).resolves.toBeUndefined();
  });

  it('lets platform admins through', async () => {
    await expect(setup({ isSuperAdmin: true }).assertMember('u', 't', 'settings.billing')).resolves.toBeUndefined();
  });

  it('only lets platform admins pass the admin check', async () => {
    await expect(setup({ roleId: 'r' }).assertSuperAdmin('u')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup({ isSuperAdmin: true }).assertSuperAdmin('u')).resolves.toBeUndefined();
  });

  describe('assertCanViewUser', () => {
    it('allows yourself', async () => {
      await expect(setup().assertCanViewUser('u', 'u')).resolves.toBeUndefined();
    });
    it('allows someone in a shared tenant', async () => {
      await expect(setup({ shares: true }).assertCanViewUser('a', 'b')).resolves.toBeUndefined();
    });
    it('rejects a stranger', async () => {
      await expect(setup().assertCanViewUser('a', 'b')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertCanManageRole', () => {
    it('rejects a member without role management', async () => {
      await expect(setup({ roleId: 'r' }).assertCanManageRole('u', 'role')).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('allows a member with role management', async () => {
      await expect(
        setup({ roleId: 'r', permissions: ['admin.roles'] }).assertCanManageRole('u', 'role', 'content.view'),
      ).resolves.toBeUndefined();
    });
    it('stops a tenant admin granting a platform permission', async () => {
      await expect(
        setup({ roleId: 'r', permissions: ['admin.roles'] }).assertCanManageRole('u', 'role', 'admin.super'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('reports an unknown role', async () => {
      await expect(setup({}, null).assertCanManageRole('u', 'role')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
