import { BadRequestException, NotFoundException } from '@nestjs/common';
// Storage isn't used by rename, and its uuid dependency is ESM-only under Jest.
jest.mock('./s3-storage.service', () => ({ S3StorageService: class {} }));

import { MediaService } from './media.service';

function setup(asset: object | null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(asset),
    save: jest.fn(async (x) => x),
  };
  const service = new MediaService(repo as never, {} as never);
  return { service, repo };
}

describe('MediaService.rename', () => {
  it('saves a tidied name for a file in this organization', async () => {
    const { service, repo } = setup({
      id: 'm1',
      tenantId: 't1',
      name: 'IMG_0042.png',
    });
    const res = await service.rename('m1', 't1', '  Summer   banner.png ');
    expect(res.name).toBe('Summer banner.png');
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'm1', tenantId: 't1' },
    });
  });

  it('rejects an empty name', async () => {
    const { service } = setup({ id: 'm1', tenantId: 't1' });
    await expect(service.rename('m1', 't1', '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a name over 200 characters', async () => {
    const { service } = setup({ id: 'm1', tenantId: 't1' });
    await expect(
      service.rename('m1', 't1', 'a'.repeat(201)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not rename another organization’s file', async () => {
    const { service, repo } = setup(null);
    await expect(service.rename('m1', 't2', 'Mine.png')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});
