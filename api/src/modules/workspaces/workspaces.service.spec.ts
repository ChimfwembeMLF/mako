import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let workspaceRepo: any;
  let automationRepo: any;

  beforeEach(() => {
    workspaceRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    automationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findOneOrFail: jest.fn(),
    };

    service = new WorkspacesService(
      workspaceRepo,
      automationRepo,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('persists a default automation config when no config row exists', async () => {
    const config = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      isActive: false,
      timezone: 'America/New_York',
      generateAt: '19:00',
      postsPerCycle: 3,
      planAheadDays: 1,
      publishingDays: [],
      postingTimes: [],
      platforms: [],
    };

    automationRepo.findOne.mockResolvedValue(null);
    automationRepo.create.mockReturnValue(config);
    automationRepo.save.mockResolvedValue(config);

    await expect(service.getAutomationConfig('workspace-1')).resolves.toEqual(config);

    expect(automationRepo.create).toHaveBeenCalledWith({ workspaceId: 'workspace-1' });
    expect(automationRepo.save).toHaveBeenCalledWith(config);
  });
});
