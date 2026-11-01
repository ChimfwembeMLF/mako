import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiKeyTestController } from './ai-key-test.controller';
import { IntegrationProvider } from '../tenants/entities/tenant-integration-config.entity';

jest.mock('./services/mistral-chat.service', () => ({ MistralChatService: class {} }));
jest.mock('./services/openai-chat.service', () => ({ OpenAIChatService: class {} }));
jest.mock('./services/gemini-chat.service', () => ({ GeminiChatService: class {} }));
jest.mock('./services/deepseek-chat.service', () => ({ DeepseekChatService: class {} }));
jest.mock('../tenants/services/tenant-access.service', () => ({ TenantAccessService: class {} }));

describe('AiKeyTestController', () => {
  const req = { user: { sub: 'u1' } };
  const repo = { findOne: jest.fn() };
  const access = { assertMember: jest.fn().mockResolvedValue(undefined) };
  const openai = { healthCheck: jest.fn() };
  const none = { healthCheck: jest.fn() };
  const controller = new AiKeyTestController(
    repo as any,
    access as any,
    none as any,
    openai as any,
    none as any,
    none as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findOne.mockResolvedValue({ id: 'c' });
  });

  it('reports a working key', async () => {
    openai.healthCheck.mockResolvedValue({ ok: true, model: 'm' });
    await expect(controller.testKey(req, 't1', IntegrationProvider.OPENAI)).resolves.toEqual({ ok: true });
    expect(openai.healthCheck).toHaveBeenCalledWith('t1');
  });

  it('reports the reason a key failed', async () => {
    openai.healthCheck.mockRejectedValue(new Error('Incorrect API key'));
    await expect(controller.testKey(req, 't1', IntegrationProvider.OPENAI)).resolves.toEqual({
      ok: false,
      message: 'Incorrect API key',
    });
  });

  it("won't test without a saved key, which would hit the platform key", async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(controller.testKey(req, 't1', IntegrationProvider.OPENAI)).rejects.toBeInstanceOf(NotFoundException);
    expect(openai.healthCheck).not.toHaveBeenCalled();
  });

  it("has nothing to test for Parler or Google Drive", async () => {
    await expect(
      controller.testKey(req, 't1', IntegrationProvider.SELF_HOSTED_PARLER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('needs billing permission', async () => {
    access.assertMember.mockRejectedValueOnce(new ForbiddenException());
    await expect(controller.testKey(req, 'other', IntegrationProvider.OPENAI)).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertMember).toHaveBeenCalledWith('u1', 'other', 'settings.billing');
    expect(openai.healthCheck).not.toHaveBeenCalled();
  });
});
