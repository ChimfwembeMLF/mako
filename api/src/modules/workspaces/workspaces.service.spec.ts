import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let workspaceRepo: any;
  let automationRepo: any;
  let auditLogs: any;

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

    auditLogs = {
      recordChange: jest.fn(),
    };

    service = new WorkspacesService(
      workspaceRepo,
      automationRepo,
      {} as any,
      {} as any,
      {} as any,
      auditLogs,
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

  it('records before and after state when automation config changes', async () => {
    const existing = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      isActive: false,
      timezone: 'America/New_York',
      generateAt: '19:00',
      postsPerCycle: 3,
      planAheadDays: 1,
      publishingDays: ['Monday'],
      postingTimes: ['09:00'],
      platforms: ['linkedin'],
    };

    const updated = {
      ...existing,
      isActive: true,
      postsPerCycle: 5,
      publishingDays: ['Monday', 'Wednesday'],
    };

    workspaceRepo.findOne.mockResolvedValue({ id: 'workspace-1', tenantId: 'tenant-1' });
    automationRepo.findOne.mockResolvedValue(existing);
    automationRepo.update.mockResolvedValue(undefined);
    automationRepo.findOneOrFail.mockResolvedValue(updated);

    await expect(service.updateAutomationConfig('workspace-1', {
      isActive: true,
      postsPerCycle: 5,
      publishingDays: ['Monday', 'Wednesday'],
    } as any)).resolves.toEqual(updated);

    expect(auditLogs.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      resourceType: 'workspace_automation_config',
      action: 'workspace_automation_config.updated',
      beforeState: expect.objectContaining({ isActive: false, postsPerCycle: 3 }),
      afterState: expect.objectContaining({ isActive: true, postsPerCycle: 5 }),
    }));
  });
});
