import { UserEntity } from 'src/modules/user/user.entity';

export class SocialAuthDto {
  accessToken: string;
  userEntity: UserEntity;
}

export class SocialAuthRegisterDto {
  provider: 'facebook' | 'google' | 'linkedin' | 'instagram';

  providerId: string;

  firstName?: string;
  lastName?: string;
  email?: string;

  isRegisteredWithGoogle?: boolean;
  isRegisteredWithFacebook?: boolean;
  isRegisteredWithLinkedIn?: boolean;
  isRegisteredWithInstagram?: boolean;

  avatar?: string;
  phone?: string;
}
