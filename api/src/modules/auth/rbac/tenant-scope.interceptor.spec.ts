import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';

jest.mock('./rbac.service', () => ({ RbacService: class {} }));
jest.mock('../../workspaces/entities/workspaces.entity', () => ({ Workspaces: class Workspaces {} }));
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';

const mine = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

const run = (
  req: Record<string, unknown>,
  resource?: unknown,
  record?: unknown,
  {
    handler = 'findOne',
    superAdmin = false,
    permission = undefined as string | undefined,
    granted = [] as string[],
    owner = false,
    workspaces = {} as Record<string, string>,
  } = {},
) => {
  const rbac = {
    canAccessTenant: jest.fn(async (_u: string, t: string) => t === mine),
    isSuperAdmin: jest.fn(async () => superAdmin),
    hasPermission: jest.fn(async (_u: string, _t: string, p: string) => granted.includes(p)),
    isTenantOwner: jest.fn(async () => owner),
  };
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === REQUIRED_PERMISSION_KEY ? permission : resource,
    ),
  };
  const findOne = jest.fn().mockResolvedValue(record);
  const dataSource = {
    getRepository: (entity: unknown) => {
      if (entity === Workspaces) {
        return { findOne: async ({ where }: any) => (workspaces[where.id] ? { tenantId: workspaces[where.id] } : null) };
      }
      return { findOne };
    },
  };
  const next = { handle: jest.fn(() => of('ok')) };
  const context = {
    getHandler: () => ({ name: handler }),
    getClass: () => undefined,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  };
  const result = lastValueFrom(
    new TenantScopeInterceptor(rbac as any, reflector as any, dataSource as any).intercept(context as any, next as any),
  );
  return { result, next, rbac, findOne };
};

const user = { user: { sub: 'u1' } };

describe('TenantScopeInterceptor', () => {
  it('lets public requests through without checking', async () => {
    const { result, rbac } = run({ params: { tenantId: other } });
    await expect(result).resolves.toBe('ok');
    expect(rbac.canAccessTenant).not.toHaveBeenCalled();
  });

  it('allows a request with no tenant', async () => {
    await expect(run({ ...user, params: {}, query: {} }).result).resolves.toBe('ok');
  });

  it.each([
    ['route', { params: { tenantId: mine } }],
    ['query', { query: { tenantId: mine } }],
    ['body', { body: { tenantId: mine } }],
  ])('allows your own tenant in the %s', async (_where, parts) => {
    await expect(run({ ...user, ...parts }).result).resolves.toBe('ok');
  });

  it.each([
    ['route', { params: { tenantId: other } }],
    ['query', { query: { tenantId: other } }],
    ['body', { body: { tenantId: other } }],
    ['query as a list', { query: { tenantId: [mine, other] } }],
    ['malformed id', { query: { tenantId: 'not-a-uuid' } }],
  ])('rejects another tenant in the %s', async (_where, parts) => {
    const { result, next } = run({ ...user, ...parts });
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('checks every tenant named in a request', async () => {
    await expect(
      run({ ...user, params: { tenantId: mine }, body: { tenantId: other } }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('records named by id', () => {
    const resource = { entity: class {}, param: 'id', field: 'id' };
    const id = '33333333-3333-4333-8333-333333333333';

    it("rejects another tenant's record", async () => {
      const { result, next } = run({ ...user, params: { id } }, resource, { tenantId: other });
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('allows your own record', async () => {
      await expect(run({ ...user, params: { id } }, resource, { tenantId: mine }).result).resolves.toBe('ok');
    });

    it('leaves a missing record to the route', async () => {
      await expect(run({ ...user, params: { id } }, resource, null).result).resolves.toBe('ok');
    });

    it('ignores route params that are not record ids', async () => {
      const { result, findOne } = run({ ...user, params: { id: 'mine' } }, resource);
      await expect(result).resolves.toBe('ok');
      expect(findOne).not.toHaveBeenCalled();
    });

    it('looks records up by the configured field', async () => {
      const { result, findOne } = run(
        { ...user, params: { depositId: id } },
        { ...resource, param: 'depositId', field: 'depositId' },
        { tenantId: mine },
      );
      await result;
      expect(findOne).toHaveBeenCalledWith({ where: { depositId: id } });
    });
  });

  describe('tenant-owned lists', () => {
    const resource = { entity: class {}, param: 'id', field: 'id' };

    it('refuses a list with no tenant', async () => {
      const { result, next } = run({ ...user, query: {} }, resource, null, { handler: 'findAll' });
      await expect(result).rejects.toThrow('tenantId is required');
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('allows the list for your tenant', async () => {
      const req = { ...user, query: { tenantId: mine } };
      await expect(run(req, resource, null, { handler: 'findAll' }).result).resolves.toBe('ok');
    });

    it('lets a platform admin list everything', async () => {
      await expect(
        run({ ...user, query: {} }, resource, null, { handler: 'findAll', superAdmin: true }).result,
      ).resolves.toBe('ok');
    });

    it('leaves other routes on the controller alone', async () => {
      await expect(run({ ...user, query: {} }, resource, null, { handler: 'stats' }).result).resolves.toBe('ok');
    });
  });

  it('understands the user shape from the older auth guard', async () => {
    await expect(
      run({ user: { id: 'u1' }, query: { tenantId: other } }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('workspaces', () => {
    const wsMine = '44444444-4444-4444-8444-444444444444';
    const wsOther = '55555555-5555-4555-8555-555555555555';
    const workspaces = { [wsMine]: mine, [wsOther]: other };

    it('allows your workspace in your tenant', async () => {
      const req = { ...user, query: { tenantId: mine, workspaceId: wsMine } };
      await expect(run(req, undefined, undefined, { workspaces }).result).resolves.toBe('ok');
    });

    it("rejects another tenant's workspace under your tenant id", async () => {
      const req = { ...user, query: { tenantId: mine, workspaceId: wsOther } };
      await expect(run(req, undefined, undefined, { workspaces }).result).rejects.toThrow(
        'Workspace does not belong to this organization',
      );
    });

    it("rejects another tenant's workspace named on its own", async () => {
      const req = { ...user, body: { workspaceId: wsOther } };
      await expect(run(req, undefined, undefined, { workspaces }).result).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an unknown workspace', async () => {
      const req = { ...user, query: { tenantId: mine, workspaceId: '66666666-6666-4666-8666-666666666666' } };
      await expect(run(req, undefined, undefined, { workspaces }).result).rejects.toThrow('Workspace not found');
    });
  });

  describe('role permissions', () => {
    const req = { ...user, body: { tenantId: mine } };

    it('allows a member whose role grants the permission', async () => {
      await expect(
        run(req, undefined, undefined, { permission: 'content.publish', granted: ['content.publish'] }).result,
      ).resolves.toBe('ok');
    });

    it('rejects a member whose role lacks it', async () => {
      const { result, next } = run(req, undefined, undefined, { permission: 'content.publish', granted: ['content.view'] });
      await expect(result).rejects.toThrow('Your role does not allow this (content.publish)');
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('always allows the tenant owner', async () => {
      await expect(
        run(req, undefined, undefined, { permission: 'content.publish', owner: true }).result,
      ).resolves.toBe('ok');
    });

    it('allows a platform super admin', async () => {
      await expect(
        run(req, undefined, undefined, { permission: 'content.publish', superAdmin: true }).result,
      ).resolves.toBe('ok');
    });

    it('needs a tenant to check against', async () => {
      await expect(
        run({ ...user, body: {} }, undefined, undefined, { permission: 'content.publish' }).result,
      ).rejects.toThrow('tenantId is required');
    });
  });
});
