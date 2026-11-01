import { PaymentsService } from './payments.service';

jest.mock('../ai/services/mistral-chat.service', () => ({ MistralChatService: class {} }));

describe('PaymentsService.handlePawaPayWebhook', () => {
  const setup = (deposit: unknown, verified = { status: 'PENDING', activated: false }) => {
    const service = Object.create(PaymentsService.prototype);
    service.depositsRepo = { findOne: jest.fn().mockResolvedValue(deposit) };
    service.checkDepositStatus = jest.fn().mockResolvedValue(verified);
    service.completeDeposit = jest.fn();
    return service;
  };

  it('never completes a deposit because the webhook says so', async () => {
    const service = setup({ depositId: 'd1', status: 'PENDING' });
    const result = await service.handlePawaPayWebhook({ depositId: 'd1', status: 'COMPLETED', depositStatus: 'COMPLETED' });
    expect(service.completeDeposit).not.toHaveBeenCalled();
    expect(service.checkDepositStatus).toHaveBeenCalledWith('d1');
    expect(result).toEqual({ received: true, status: 'PENDING', activated: false });
  });

  it('reports what PawaPay confirmed', async () => {
    const service = setup({ depositId: 'd1' }, { status: 'COMPLETED', activated: true });
    await expect(service.handlePawaPayWebhook({ depositId: 'd1' })).resolves.toEqual({
      received: true,
      status: 'COMPLETED',
      activated: true,
    });
  });

  it.each([[null], [{}], [{ depositId: 5 }]])('ignores a malformed body %j', async (body) => {
    const service = setup({ depositId: 'd1' });
    await expect(service.handlePawaPayWebhook(body)).resolves.toEqual({ received: true });
    expect(service.checkDepositStatus).not.toHaveBeenCalled();
  });

  it('ignores an unknown deposit', async () => {
    const service = setup(null);
    await expect(service.handlePawaPayWebhook({ depositId: 'x' })).resolves.toEqual({ received: true });
    expect(service.checkDepositStatus).not.toHaveBeenCalled();
  });
});
