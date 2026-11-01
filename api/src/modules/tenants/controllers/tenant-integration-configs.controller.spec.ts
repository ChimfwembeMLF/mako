import { ForbiddenException } from '@nestjs/common';
import { TenantIntegrationConfigsController } from './tenant-integration-configs.controller';
import { IntegrationProvider } from '../entities/tenant-integration-config.entity';

jest.mock('../../auth/rbac/tenant-access.service', () => ({ TenantAccessService: class {} }));
jest.mock('../services/encryption.service', () => ({ EncryptionService: class {} }));

describe('TenantIntegrationConfigsController', () => {
  const req = { user: { sub: 'u1' } } as any;
  const repo = {
    find: jest.fn().mockResolvedValue([
      { id: 'c', tenantId: 't1', provider: 'openai', encryptedApiKey: 'SECRET', iv: 'i', authTag: 'a', updated_at: new Date() },
    ]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => x),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const encryption = { encrypt: jest.fn().mockReturnValue({ encryptedData: 'e', iv: 'i', authTag: 'a' }) };
  const access = { assertMember: jest.fn().mockResolvedValue(undefined) };
  const controller = new TenantIntegrationConfigsController(repo as any, encryption as any, access as any);

  beforeEach(() => jest.clearAllMocks());

  it('never returns key material', async () => {
    const [config] = await controller.getConfigs(req, 't1');
    expect(JSON.stringify(config)).not.toContain('SECRET');
    expect(config).not.toHaveProperty('iv');
    expect(access.assertMember).toHaveBeenCalledWith('u1', 't1');
  });

  it("won't list another tenant's keys", async () => {
    access.assertMember.mockRejectedValueOnce(new ForbiddenException());
    await expect(controller.getConfigs(req, 'other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('needs billing permission to save a key', async () => {
    access.assertMember.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      controller.upsertConfig(req, 'other', { provider: IntegrationProvider.OPENAI, apiKey: 'k' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertMember).toHaveBeenCalledWith('u1', 'other', 'settings.billing');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('trims a pasted key before encrypting it', async () => {
    await controller.upsertConfig(req, 't1', { provider: IntegrationProvider.OPENAI, apiKey: '  sk-1\n' });
    expect(encryption.encrypt).toHaveBeenCalledWith('sk-1');
  });

  it('needs billing permission to remove a key', async () => {
    access.assertMember.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      controller.deleteConfig(req, 'other', IntegrationProvider.OPENAI),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
