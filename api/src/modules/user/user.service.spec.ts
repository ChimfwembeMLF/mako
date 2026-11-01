import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).useMocker(() => ({})).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('stores a reset password without firing the hashing subscriber', async () => {
    const execute = jest.fn();
    const callListeners = jest.fn(() => ({ execute }));
    const where = jest.fn(() => ({ callListeners }));
    const set = jest.fn(() => ({ where }));
    const builder = { update: () => ({ set }) };
    Object.assign(service, { userRepository: { createQueryBuilder: () => builder } });

    await service.updatePassword('u1', 'already-hashed');

    expect(set).toHaveBeenCalledWith({ password: 'already-hashed' });
    expect(callListeners).toHaveBeenCalledWith(false);
    expect(execute).toHaveBeenCalled();
  });
});
