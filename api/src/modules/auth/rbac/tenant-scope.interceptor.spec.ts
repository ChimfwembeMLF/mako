import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';

jest.mock('./rbac.service', () => ({ RbacService: class {} }));

const mine = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

const run = (req: Record<string, unknown>, resource?: unknown, record?: unknown) => {
  const rbac = { canAccessTenant: jest.fn(async (_u: string, t: string) => t === mine) };
  const reflector = { getAllAndOverride: jest.fn(() => resource) };
  const findOne = jest.fn().mockResolvedValue(record);
  const dataSource = { getRepository: () => ({ findOne }) };
  const next = { handle: jest.fn(() => of('ok')) };
  const context = {
    getHandler: () => undefined,
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

  it('understands the user shape from the older auth guard', async () => {
    await expect(
      run({ user: { id: 'u1' }, query: { tenantId: other } }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
