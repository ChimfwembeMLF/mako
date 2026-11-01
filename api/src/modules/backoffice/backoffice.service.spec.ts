import { BackofficeService } from './backoffice.service';

jest.mock('../payments/payments.service', () => ({ PaymentsService: class {} }));

describe('BackofficeService.updatePlans', () => {
  it('returns the same list shape as getPlans', async () => {
    const list = [{ key: 'free' }, { key: 'starter' }, { key: 'pro' }];
    const plans = {
      updatePlans: jest.fn().mockResolvedValue({ free: {}, starter: {}, pro: {} }),
      getPlansList: jest.fn().mockReturnValue(list),
    };
    const service = Object.create(BackofficeService.prototype);
    service.plans = plans;

    await expect(service.updatePlans({ pro: { priceZmw: 500 } })).resolves.toEqual(list);
    expect(plans.updatePlans).toHaveBeenCalledWith({ pro: { priceZmw: 500 } });
  });
});
