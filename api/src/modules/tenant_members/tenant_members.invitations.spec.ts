import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantMembersService } from './tenant_members.service';

jest.mock('../user/user.service', () => ({ UserService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));

const INV_ID = '11111111-1111-4111-8111-111111111111';

function setup(opts: { user?: object | null; member?: object | null; invitation?: object | null } = {}) {
  const saved: unknown[] = [];
  const members = {
    findOne: jest.fn().mockResolvedValue(opts.member ?? null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => {
      saved.push(x);
      return x;
    }),
  };
  const invitations = {
    findOne: jest.fn().mockResolvedValue(opts.invitation ?? null),
    create: jest.fn((x) => ({ id: INV_ID, ...x })),
    save: jest.fn(async (x) => x),
  };
  const tenants = { findOne: jest.fn().mockResolvedValue({ id: 't1', name: 'Acme' }) };
  const users = { findOne: jest.fn().mockResolvedValue(opts.user ?? null) };
  const mail = { sendWorkspaceInviteEmail: jest.fn() };
  const config = { get: (k: string) => (k === 'JWT_SECRET' ? 'test-secret' : k === 'FRONTEND_URL' ? 'https://app.test' : undefined) };
  const service = new TenantMembersService(
    members as never,
    invitations as never,
    {} as never,
    tenants as never,
    users as never,
    mail as never,
    config as never,
  );
  return { service, members, invitations, mail, users, saved };
}

const pendingInvite = (over: object = {}) => ({
  id: INV_ID,
  tenantId: 't1',
  email: 'ann@example.com',
  roleId: 'r1',
  invitedBy: 'owner',
  status: 'pending',
  expiresAt: new Date(Date.now() + 60_000),
  ...over,
});

describe('TenantMembersService invitations', () => {
  it('does not add an existing user directly; it emails an invitation instead', async () => {
    const { service, members, mail } = setup({ user: { id: 'u-ann', email: 'ann@example.com' } });

    const res = await service.invite({ email: 'Ann@Example.com', tenantId: 't1', roleId: 'r1', invitedBy: 'owner' });

    expect(res.pending).toBe(true);
    expect(members.save).not.toHaveBeenCalled();
    const [to, , link, hasAccount] = mail.sendWorkspaceInviteEmail.mock.calls[0];
    expect(to).toBe('ann@example.com');
    expect(hasAccount).toBe(true);
    expect(link).toContain(`/invite?id=${INV_ID}&token=${service.invitationToken(INV_ID)}`);
  });

  it('refuses to invite someone who is already an active member', async () => {
    const { service } = setup({ user: { id: 'u-ann' }, member: { isActive: true } });
    await expect(
      service.invite({ email: 'ann@example.com', tenantId: 't1', roleId: 'r1', invitedBy: 'owner' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts with the emailed token when signed in as the invited email', async () => {
    const inv = pendingInvite();
    const { service, saved } = setup({ invitation: inv, user: { id: 'u-ann', email: 'ANN@example.com' } });

    const res = await service.acceptInvitation(INV_ID, service.invitationToken(INV_ID), 'u-ann');

    expect(res.tenantId).toBe('t1');
    expect(saved).toContainEqual(expect.objectContaining({ tenantId: 't1', userId: 'u-ann', roleId: 'r1', isActive: true }));
    expect(inv.status).toBe('accepted');
  });

  it('rejects a wrong or missing token', async () => {
    const { service, members } = setup({ invitation: pendingInvite(), user: { id: 'u-ann', email: 'ann@example.com' } });
    await expect(service.acceptInvitation(INV_ID, 'forged', 'u-ann')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.acceptInvitation(INV_ID, undefined, 'u-ann')).rejects.toBeInstanceOf(ForbiddenException);
    expect(members.save).not.toHaveBeenCalled();
  });

  it('rejects a different account even with the right token', async () => {
    const { service, members } = setup({ invitation: pendingInvite(), user: { id: 'u-bob', email: 'bob@example.com' } });
    await expect(
      service.acceptInvitation(INV_ID, service.invitationToken(INV_ID), 'u-bob'),
    ).rejects.toThrow('Sign in with that email');
    expect(members.save).not.toHaveBeenCalled();
  });

  it('rejects an expired or already-used invitation', async () => {
    const user = { id: 'u-ann', email: 'ann@example.com' };
    const expired = setup({ invitation: pendingInvite({ expiresAt: new Date(Date.now() - 1) }), user });
    await expect(
      expired.service.acceptInvitation(INV_ID, expired.service.invitationToken(INV_ID), 'u-ann'),
    ).rejects.toThrow('expired');
    const used = setup({ invitation: pendingInvite({ status: 'revoked' }), user });
    await expect(
      used.service.acceptInvitation(INV_ID, used.service.invitationToken(INV_ID), 'u-ann'),
    ).rejects.toThrow('already revoked');
  });

  it('declines without adding the member', async () => {
    const inv = pendingInvite();
    const { service, members } = setup({ invitation: inv, user: { id: 'u-ann', email: 'ann@example.com' } });
    await service.declineInvitation(INV_ID, service.invitationToken(INV_ID), 'u-ann');
    expect(inv.status).toBe('declined');
    expect(members.save).not.toHaveBeenCalled();
  });
});
