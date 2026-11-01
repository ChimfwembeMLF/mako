import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsController } from './tenants.controller';
import { IntegrationProvider } from './entities/tenant-integration-config.entity';

jest.mock('./tenants.service', () => ({ TenantsService: class {} }));
jest.mock('./services/tenant-access.service', () => ({ TenantAccessService: class {} }));

describe('TenantsController', () => {
  const req = { user: { sub: 'u1' } } as any;
  const service = {
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  };
  const access = {
    assertMember: jest.fn().mockResolvedValue(undefined),
    assertSuperAdmin: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new TenantsController(service as any, access as any);

  beforeEach(() => jest.clearAllMocks());

  it('requires login on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TenantsController)).toContain(JwtAuthGuard);
  });

  it('checks membership before reading a tenant', async () => {
    access.assertMember.mockRejectedValueOnce(new ForbiddenException());
    await expect(controller.findOne(req, 't1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('keeps listing, creating and deleting tenants to platform admins', async () => {
    access.assertSuperAdmin.mockRejectedValue(new ForbiddenException());
    await expect(controller.findAll(req)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create(req, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.remove(req, 't1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
    access.assertSuperAdmin.mockResolvedValue(undefined);
  });

  it('needs billing permission to change the AI provider', async () => {
    await controller.update(req, 't1', { preferredAiProvider: IntegrationProvider.OPENAI } as any);
    expect(access.assertMember).toHaveBeenCalledWith('u1', 't1', 'settings.billing');
  });

  it('needs only settings access for an ordinary update', async () => {
    await controller.update(req, 't1', { name: 'New' } as any);
    expect(access.assertMember).toHaveBeenCalledTimes(1);
    expect(access.assertMember).toHaveBeenCalledWith('u1', 't1', 'settings.view');
  });

  it('keeps ownership changes to platform admins', async () => {
    await controller.update(req, 't1', { ownerId: 'u2' } as any);
    expect(access.assertSuperAdmin).toHaveBeenCalledWith('u1');
  });

  it('refuses Google Drive as an AI provider', async () => {
    await expect(
      controller.update(req, 't1', { preferredAiProvider: IntegrationProvider.GOOGLE_DRIVE } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
