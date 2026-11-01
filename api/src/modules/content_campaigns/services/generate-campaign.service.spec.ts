import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GenerateCampaignDto } from '../dto/generate-campaign.dto';
import { GenerateCampaignService } from './generate-campaign.service';

jest.mock('../../ai/services/ai-provider-router.service', () => ({ AiProviderRouter: class {} }));
jest.mock('../../ai/services/ai-usage-tracker.service', () => ({ AiUsageTrackerService: class {} }));
jest.mock('../../brand_profiles/brand_profiles.service', () => ({ BrandProfilesService: class {} }));

const wanted = (messages: Array<{ content: string }>) =>
  Number(/Exactly (\d+) (posts|angles)/.exec(messages[0].content)?.[1]);

/** Behaves like the AI: returns what the prompt asks for, numbering each batch from zero. */
const answer = (messages: Array<{ content: string }>) => {
  const count = wanted(messages);
  if (messages[0].content.includes('Outline')) {
    return {
      data: {
        name: 'Plan',
        summary: 'Sum',
        angles: Array.from({ length: count }, (_, i) => `Angle ${i + 1}`),
      },
      tokensUsed: 100,
    };
  }
  return {
    data: {
      posts: Array.from({ length: count }, (_, i) => ({
        dayOffset: i,
        platform: 'linkedin',
        title: `Post ${i}`,
        content: '<p>x</p>',
      })),
    },
    tokensUsed: 500,
  };
};

const setup = (completeJson = jest.fn(async (messages) => answer(messages))) => {
  const usage = { assertWithinLimit: jest.fn(), record: jest.fn() };
  const contentRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    find: jest.fn(),
    update: jest.fn(),
  };
  const campaignRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 'c', ...x })),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const service = new GenerateCampaignService(
    { completeJson, premiumModel: 'm' } as any,
    { brandFromEntity: () => ({}) } as any,
    usage as any,
    campaignRepo as any,
    contentRepo as any,
    { resolveForContext: async () => ({ id: 'b' }) } as any,
  );
  const run = (postCount: number) =>
    service.generate({ userId: 'u', tenantId: 't', workspaceId: 'w', theme: 'Launch', postCount, startDate: '2026-12-01' });
  return { run, service, completeJson, usage, contentRepo, campaignRepo };
};

describe('GenerateCampaignService', () => {
  it('writes a short campaign in one request', async () => {
    const { run, completeJson } = setup();
    const { posts } = await run(7);
    expect(completeJson).toHaveBeenCalledTimes(1);
    expect(posts).toHaveLength(7);
  });

  it('writes 50 posts through an outline and batches', async () => {
    const { run, completeJson } = setup();
    const { posts } = await run(50);
    expect(completeJson).toHaveBeenCalledTimes(6);
    expect(posts).toHaveLength(50);
  });

  it('gives every post in a long campaign its own day', async () => {
    const { run } = setup();
    const { posts } = await run(23);
    const days = posts.map((p) => (p.scheduledDate as Date).toDateString());
    expect(new Set(days).size).toBe(23);
    expect(posts[22].scheduledDate.getDate()).toBe(23);
  });

  it('hands each batch only its own angles', async () => {
    const { run, completeJson } = setup();
    await run(12);
    const prompts = completeJson.mock.calls.slice(1).map(([m]) => m[1].content);
    const second = prompts.find((p) => p.includes('posts 11 to 12'));
    expect(second).toContain('Angle 11');
    expect(second).not.toContain('Angle 10\n');
  });

  it('retries a failed batch once', async () => {
    let failed = false;
    const completeJson = jest.fn(async (messages) => {
      if (!failed && !messages[0].content.includes('Outline')) {
        failed = true;
        throw new Error('rate limited');
      }
      return answer(messages);
    });
    const { run } = setup(completeJson);
    expect((await run(20)).posts).toHaveLength(20);
    expect(completeJson).toHaveBeenCalledTimes(4);
  });

  it('saves nothing if a batch keeps failing, but still counts the spend', async () => {
    const completeJson = jest.fn(async (messages) => {
      if (messages[1].content.includes('posts 11 to 20')) throw new Error('down');
      return answer(messages);
    });
    const { run, campaignRepo, contentRepo, usage } = setup(completeJson);
    await expect(run(20)).rejects.toThrow('down');
    expect(campaignRepo.save).not.toHaveBeenCalled();
    expect(contentRepo.save).not.toHaveBeenCalled();
    expect(usage.record).toHaveBeenCalledTimes(1);
  });

  it('rejects a batch that comes back short', async () => {
    const completeJson = jest.fn(async (messages) => {
      const reply = answer(messages);
      return messages[0].content.includes('Outline')
        ? reply
        : { ...reply, data: { posts: reply.data.posts!.slice(0, 2) } };
    });
    const { run, contentRepo } = setup(completeJson as any);
    await expect(run(20)).rejects.toThrow('try again');
    expect(contentRepo.save).not.toHaveBeenCalled();
  });

  it('rejects an outline with too few angles', async () => {
    const { run } = setup(jest.fn(async () => ({ data: { angles: ['one'] }, tokensUsed: 1 })) as any);
    await expect(run(20)).rejects.toThrow('try again');
  });

  it('records one usage entry with the total tokens', async () => {
    const { run, usage } = setup();
    await run(50);
    expect(usage.record).toHaveBeenCalledTimes(1);
    expect(usage.record.mock.calls[0][0].tokensUsed).toBe(100 + 5 * 500);
  });

  it('saves generated posts as dated drafts for review', async () => {
    const { run, campaignRepo } = setup();
    const { posts } = await run(5);
    expect(posts.every((p) => p.status === 'draft')).toBe(true);
    expect(posts.every((p) => p.scheduledDate)).toBe(true);
    expect(campaignRepo.save.mock.calls[0][0].status).toBe('review');
  });

  describe('approve', () => {
    const today = new Date('2026-12-10T12:00:00');
    const draft = (day: number) => ({ status: 'draft', scheduledDate: new Date(2026, 11, day) });
    const ready = (posts: unknown[]) => {
      const repos = setup();
      repos.campaignRepo.findOne.mockResolvedValue({ id: 'c', status: 'review' });
      repos.contentRepo.find.mockResolvedValue(posts);
      return repos;
    };

    it('schedules the drafts and activates the campaign', async () => {
      const posts = [draft(12), draft(13)];
      const { service, campaignRepo } = ready(posts);
      await expect(service.approve('c', 't', today)).resolves.toEqual({ approved: 2, shiftedDays: 0 });
      expect(posts.map((p) => p.status)).toEqual(['scheduled', 'scheduled']);
      expect(campaignRepo.save.mock.calls[0][0].status).toBe('active');
    });

    it('moves a late series forward and keeps its spacing', async () => {
      const posts = [draft(7), draft(8), draft(10)];
      const { service } = ready(posts);
      const result = await service.approve('c', 't', today);
      expect(result.shiftedDays).toBe(3);
      expect(posts.map((p) => p.scheduledDate.getDate())).toEqual([10, 11, 13]);
    });

    it('leaves a series starting today alone', async () => {
      const { service } = ready([draft(10)]);
      await expect(service.approve('c', 't', today)).resolves.toMatchObject({ shiftedDays: 0 });
    });

    it('only touches drafts belonging to this campaign and tenant', async () => {
      const { service, contentRepo } = ready([draft(12)]);
      await service.approve('c', 't', today);
      expect(contentRepo.find).toHaveBeenCalledWith({
        where: { campaignId: 'c', tenantId: 't', status: 'draft' },
      });
    });

    it('refuses when nothing is left to approve', async () => {
      const { service } = ready([]);
      await expect(service.approve('c', 't', today)).rejects.toThrow('no drafts');
    });

    it('reports an unknown campaign', async () => {
      const { service, campaignRepo } = setup();
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(service.approve('c', 't', today)).rejects.toThrow('not found');
    });
  });

  it('never un-publishes posts when a campaign is deleted', async () => {
    const { service, campaignRepo, contentRepo } = setup();
    campaignRepo.findOne.mockResolvedValue({ id: 'c' });
    await service.remove('c', 't');
    const [where] = contentRepo.update.mock.calls[0];
    expect(where.status.value).toEqual(['scheduled', 'approved']);
  });

  it.each([[2, false], [3, true], [50, true], [51, false]])('validates %d posts as %s', (postCount, ok) => {
    const dto = plainToInstance(GenerateCampaignDto, { postCount, theme: 't', tenantId: 'a', workspaceId: 'b' });
    const errors = validateSync(dto).filter((e) => e.property === 'postCount');
    expect(errors.length === 0).toBe(ok);
  });
});
