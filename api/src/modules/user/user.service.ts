import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PageMetaDto } from 'src/common/dtos/page-meta.dto';
import { PageOptionsDto } from 'src/common/dtos/page-options.dto';
import { PageResponseDto } from 'src/common/dtos/page-response.dto';
import {
  FindManyOptions,
  FindOptionsWhere,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { SocialAuthRegisterDto } from '../auth/dtos/social-auth.dto';
import { UserRegisterDto } from '../auth/dtos/user-register.dto';
import { UserDto } from './dtos/user.dto';
import { UserEntity } from './user.entity';
import { decryptToken, encryptToken } from '../../common/utils/token-crypto.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    provider?: string;
  }): Promise<UserEntity> {
    const user = this.userRepository.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      provider: data.provider || 'local',
      // Set optional fields to null/undefined to avoid validation errors
      phone: null,
      providerId: null,
    });
    return this.userRepository.save(user);
  }

  async createSociallAuthUser(
    socialAuthDto: SocialAuthRegisterDto,
  ): Promise<UserEntity> {
    const user = this.userRepository.create(socialAuthDto);
    await this.userRepository.save(user);
    return user;
  }
  /**
   * Find single user
   */
  findOne(findData: FindOptionsWhere<UserEntity>): Promise<UserEntity | null> {
    return this.userRepository.findOneBy(findData);
  }

  public async getUsers(
    pageOptionsDto: PageOptionsDto,
  ): Promise<[number, UserEntity[]]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    queryBuilder
      .orderBy('user.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take);

    const [data, itemCount] = await queryBuilder.getManyAndCount();
    return [itemCount, data];
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(userId, { password: hashedPassword });
  }

  save(user: UserEntity): Promise<UserEntity> {
    return this.userRepository.save(user);
  }

  async anonymizeUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      email: `deleted-${userId.slice(0, 8)}@anonymized.local`,
      firstName: 'Deleted',
      lastName: 'User',
      phone: null,
      providerId: null,
      googleAccessTokenEnc: null,
      googleRefreshTokenEnc: null,
      googleTokenExpiresAt: null,
    } as Partial<UserEntity>);
  }

  async updateGoogleOAuthTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
  ): Promise<void> {
    const patch: Partial<UserEntity> = {
      googleAccessTokenEnc: encryptToken(tokens.accessToken),
      googleTokenExpiresAt: tokens.expiresAt,
    };
    if (tokens.refreshToken) {
      patch.googleRefreshTokenEnc = encryptToken(tokens.refreshToken);
    }
    await this.userRepository.update(userId, patch);
  }

  async clearGoogleOAuthTokens(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      googleAccessTokenEnc: null,
      googleRefreshTokenEnc: null,
      googleTokenExpiresAt: null,
    });
  }

  async getGoogleOAuthTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  } | null> {
    const row = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.googleAccessTokenEnc')
      .addSelect('user.googleRefreshTokenEnc')
      .addSelect('user.googleTokenExpiresAt')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!row?.googleAccessTokenEnc) return null;

    return {
      accessToken: decryptToken(row.googleAccessTokenEnc),
      refreshToken: row.googleRefreshTokenEnc
        ? decryptToken(row.googleRefreshTokenEnc)
        : undefined,
      expiresAt: row.googleTokenExpiresAt ?? undefined,
    };
  }
}
