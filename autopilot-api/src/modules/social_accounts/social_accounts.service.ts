import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import axios from 'axios';
import { google, Auth } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { SocialAccounts } from './entities/social_accounts.entity';
import { SocialAccountsCreateDto } from './dto/create-social_accounts.dto';
import { TenantMembersService } from '../tenant_members/tenant_members.service';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);
  private readonly googleOauthClient: Auth.OAuth2Client;

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly config: ConfigService,
    private readonly tenantMembersService: TenantMembersService,
  ) {
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    this.googleOauthClient = new google.auth.OAuth2(googleClientId, googleClientSecret);
  }

  toPublicAccount(account: SocialAccounts) {
    const { accessToken, refreshToken, ...safe } = account;
    return safe;
  }

  async assertTenantAccess(userId: string, tenantId: string) {
    const memberships = await this.tenantMembersService.findForUser(userId);
    const allowed = memberships.some((m) => m.tenantId === tenantId && m.isActive);
    if (!allowed) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  async connectAccount(dto: SocialAccountsCreateDto) {
    if (!dto.userId) {
      throw new UnauthorizedException('UserId is required');
    }
    if (!dto.tenantId) {
      throw new ForbiddenException('tenantId is required');
    }

    await this.assertTenantAccess(dto.userId, dto.tenantId);

    const existing = await this.repo.findOne({
      where: {
        tenantId: dto.tenantId,
        platform: dto.platform,
        externalId: dto.externalId ? dto.externalId : IsNull(),
      },
    });

    if (existing) {
      Object.assign(existing, dto);
      existing.connected = true;
      const saved = await this.repo.save(existing);
      return this.toPublicAccount(saved);
    }

    const saved = await this.repo.save(
      this.repo.create({
        ...dto,
        connected: true,
      }),
    );
    return this.toPublicAccount(saved);
  }

  async refreshAccessTokenIfNeeded(account: SocialAccounts) {
    if (!account.expiresAt) {
      return account;
    }

    const bufferMs = 5 * 60 * 1000;
    if (account.expiresAt.getTime() - Date.now() > bufferMs) {
      return account;
    }

    try {
      const refreshed = await this.refreshProviderToken(account);
      if (!refreshed) {
        return account;
      }

      Object.assign(account, refreshed);
      return this.repo.save(account);
    } catch (error) {
      this.logger.warn('Unable to refresh social account token', {
        id: account.id,
        platform: account.platform,
        error: error instanceof Error ? error.message : error,
      });
      return account;
    }
  }

  private async refreshProviderToken(account: SocialAccounts) {
    switch (account.platform) {
      case 'facebook':
        return this.refreshFacebookToken(account.accessToken);
      case 'instagram':
        return this.refreshInstagramToken(account.accessToken);
      case 'linkedin':
        return account.refreshToken
          ? this.refreshLinkedInToken(account.refreshToken)
          : undefined;
      case 'google':
        return account.refreshToken
          ? this.refreshGoogleToken(account.refreshToken)
          : undefined;
      default:
        return undefined;
    }
  }

  private async refreshFacebookToken(accessToken: string) {
    const appId = this.config.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) {
      throw new Error('Facebook app credentials are not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: accessToken,
    });

    const { data } = await axios.get<{ access_token: string; expires_in?: number }>(
      `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new Error('Facebook token refresh failed');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async refreshInstagramToken(accessToken: string) {
    const clientId =
      this.config.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.config.get<string>('FACEBOOK_APP_ID');
    const clientSecret =
      this.config.get<string>('INSTAGRAM_CLIENT_SECRET') ||
      this.config.get<string>('FACEBOOK_APP_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Instagram credentials are not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: accessToken,
    });

    const { data } = await axios.get<{ access_token: string; expires_in?: number }>(
      `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new Error('Instagram token refresh failed');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async refreshLinkedInToken(refreshToken: string) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
    });

    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    }>('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!data.access_token) {
      throw new Error('LinkedIn refresh failed');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async refreshGoogleToken(refreshToken: string) {
    this.googleOauthClient.setCredentials({ refresh_token: refreshToken });
    const refreshedResponse = await this.googleOauthClient.refreshAccessToken();
    const refreshed = refreshedResponse.credentials;

    if (!refreshed.access_token) {
      throw new Error('Google refresh failed');
    }

    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      expiresAt: refreshed.expiry_date
        ? new Date(refreshed.expiry_date)
        : undefined,
    };
  }

  async findByTenant(tenantId: string, userId: string) {
    await this.assertTenantAccess(userId, tenantId);
    const accounts = await this.repo.find({
      where: { tenantId, connected: true },
      order: { created_at: 'DESC' },
    });
    const refreshed = await Promise.all(
      accounts.map(async (account) => this.refreshAccessTokenIfNeeded(account)),
    );
    return refreshed.map((a) => this.toPublicAccount(a));
  }

  async findByUser(userId: string) {
    const accounts = await this.repo.find({ where: { userId } });
    const refreshed = await Promise.all(
      accounts.map(async (account) => this.refreshAccessTokenIfNeeded(account)),
    );
    return refreshed.map((a) => this.toPublicAccount(a));
  }

  async findOne(id: string) {
    const acc = await this.repo.findOne({ where: { id } });
    if (!acc) throw new NotFoundException('Not found');
    return acc;
  }

  async findOneForUser(id: string, userId: string) {
    const acc = await this.repo.findOne({ where: { id, userId } });
    if (!acc) throw new NotFoundException('Not found');
    return acc;
  }

  async findOneForTenant(id: string, tenantId: string, userId: string) {
    await this.assertTenantAccess(userId, tenantId);
    const acc = await this.repo.findOne({ where: { id, tenantId } });
    if (!acc) throw new NotFoundException('Not found');
    return acc;
  }

  async disconnect(id: string, userId: string, tenantId?: string) {
    const acc = tenantId
      ? await this.findOneForTenant(id, tenantId, userId)
      : await this.findOneForUser(id, userId);
    acc.connected = false;
    acc.accessToken = null as any;
    acc.refreshToken = null as any;
    acc.expiresAt = null as any;
    const saved = await this.repo.save(acc);
    return this.toPublicAccount(saved);
  }

  async remove(id: string, userId: string, tenantId?: string) {
    if (tenantId) {
      await this.findOneForTenant(id, tenantId, userId);
    } else {
      await this.findOneForUser(id, userId);
    }
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException();
  }
}
