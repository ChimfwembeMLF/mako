import { Test, TestingModule } from '@nestjs/testing';

// uuid ships ESM only, which Jest can't load through UserService's imports.
jest.mock('uuid', () => ({ v4: () => 'id' }));

import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
    }).useMocker(() => ({})).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
