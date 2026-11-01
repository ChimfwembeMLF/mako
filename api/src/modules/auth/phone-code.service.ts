import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { SmsService } from '../sms/sms.service';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';

export type PhoneCodePurpose = 'verify_phone' | 'reset_password';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
/** Every send costs money, so a user or attacker can't trigger them freely. */
const MAX_SENDS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

const MESSAGES: Record<PhoneCodePurpose, (code: string) => string> = {
  verify_phone: (code) =>
    `Your Mako verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  reset_password: (code) =>
    `Your Mako password reset code is ${code}. It expires in 10 minutes. Do not share this code.`,
};

/** One-time SMS codes. Only a hash is stored, and each user has one active code at a time. */
@Injectable()
export class PhoneCodeService {
  constructor(
    private readonly users: UserService,
    private readonly sms: SmsService,
  ) {}

  async send(
    user: UserEntity,
    purpose: PhoneCodePurpose,
    phone: string,
    now = new Date(),
  ): Promise<void> {
    this.assertCanSend(user, now);

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const windowOpen =
      user.phoneCodeWindowStart &&
      now.getTime() - user.phoneCodeWindowStart.getTime() < SEND_WINDOW_MS;

    user.phoneCodeHash = await bcrypt.hash(code, 10);
    user.phoneCodePurpose = purpose;
    user.phoneCodeExpiresAt = new Date(now.getTime() + CODE_TTL_MS);
    user.phoneCodeAttempts = 0;
    user.phoneCodeSentAt = now;
    user.phoneCodeWindowStart = windowOpen ? user.phoneCodeWindowStart : now;
    user.phoneCodeSendCount = windowOpen ? user.phoneCodeSendCount + 1 : 1;
    await this.users.save(user);

    await this.sms.send({ to: phone, message: MESSAGES[purpose](code), type: 'OTP' });
  }

  /** Spends one attempt. A correct code is cleared, so it can only be used once. */
  async verify(
    user: UserEntity,
    purpose: PhoneCodePurpose,
    code: string,
    now = new Date(),
  ): Promise<boolean> {
    const usable =
      user.phoneCodeHash &&
      user.phoneCodePurpose === purpose &&
      user.phoneCodeExpiresAt &&
      user.phoneCodeExpiresAt > now &&
      user.phoneCodeAttempts < MAX_ATTEMPTS;
    if (!usable) return false;

    user.phoneCodeAttempts += 1;
    await this.users.save(user);

    if (!(await bcrypt.compare(code, user.phoneCodeHash as string))) return false;

    user.phoneCodeHash = null;
    user.phoneCodePurpose = null;
    user.phoneCodeExpiresAt = null;
    await this.users.save(user);
    return true;
  }

  private assertCanSend(user: UserEntity, now: Date): void {
    const tooSoon =
      user.phoneCodeSentAt &&
      now.getTime() - user.phoneCodeSentAt.getTime() < RESEND_COOLDOWN_MS;
    const windowOpen =
      user.phoneCodeWindowStart &&
      now.getTime() - user.phoneCodeWindowStart.getTime() < SEND_WINDOW_MS;

    if (tooSoon || (windowOpen && user.phoneCodeSendCount >= MAX_SENDS_PER_WINDOW)) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
