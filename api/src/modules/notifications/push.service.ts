import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevicePushTokenEntity } from '../user/entities/device-push-token.entity';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(DevicePushTokenEntity)
    private readonly pushTokenRepo: Repository<DevicePushTokenEntity>,
  ) {}

  async sendExpoPushNotification(
    userId: string,
    title: string,
    body: string,
    url?: string,
  ): Promise<void> {
    try {
      const tokens = await this.pushTokenRepo.find({
        where: { user: { id: userId } },
      });

      if (tokens.length === 0) {
        return;
      }

      const expoTokens = tokens.map((t) => t.token);

      const message: any = {
        to: expoTokens,
        title,
        body,
        sound: 'default',
      };

      if (url) {
        message.data = { url };
      }

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to send expo push notification: ${response.status} ${errorText}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error sending expo push notification: ${error}`);
    }
  }
}
