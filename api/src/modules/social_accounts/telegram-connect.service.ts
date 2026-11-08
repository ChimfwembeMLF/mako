import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { SocialAccountsService } from './social_accounts.service';

type TelegramChat = {
  id: number;
  title?: string;
  username?: string;
  type: string;
};

/**
 * Connects a Telegram bot to a channel or group. Telegram needs no app review: the
 * user creates a bot with @BotFather and adds it to their channel as an admin.
 */
@Injectable()
export class TelegramConnectService {
  constructor(private readonly accounts: SocialAccountsService) {}

  private async call<T>(
    token: string,
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    try {
      const { data } = await axios.post(
        `https://api.telegram.org/bot${token}/${method}`,
        params,
        { timeout: 15_000 },
      );
      return data.result as T;
    } catch (err) {
      const description = (
        err as { response?: { data?: { description?: string } } }
      )?.response?.data?.description;
      // The URL contains the bot token, so only Telegram's own message is surfaced.
      throw new BadRequestException(
        method === 'getMe'
          ? "That bot token didn't work. Copy it again from @BotFather."
          : description?.includes('chat not found')
          ? "Telegram couldn't find that channel or group. Use its @username, and add the bot to it first."
          : `Telegram: ${description ?? 'request failed'}`,
      );
    }
  }

  async connect(params: {
    tenantId: string;
    workspaceId?: string;
    userId: string;
    botToken: string;
    chat: string;
  }) {
    const token = params.botToken.trim();
    if (!/^\d+:[\w-]{20,}$/.test(token)) {
      throw new BadRequestException(
        "That doesn't look like a bot token. It looks like 123456:ABC-DEF… and comes from @BotFather.",
      );
    }
    const raw = params.chat.trim().replace(/^https?:\/\/t\.me\//, '');
    const chatRef = /^-?\d+$/.test(raw) ? raw : `@${raw.replace(/^@/, '')}`;

    const bot = await this.call<{ id: number; username: string }>(
      token,
      'getMe',
    );
    const chat = await this.call<TelegramChat>(token, 'getChat', {
      chat_id: chatRef,
    });
    const member = await this.call<{
      status: string;
      can_post_messages?: boolean;
    }>(token, 'getChatMember', {
      chat_id: chat.id,
      user_id: bot.id,
    });
    const canPost =
      chat.type === 'channel'
        ? member.status === 'administrator' &&
          member.can_post_messages !== false
        : ['administrator', 'member', 'creator'].includes(member.status);
    if (!canPost) {
      throw new BadRequestException(
        chat.type === 'channel'
          ? `Make @${bot.username} an admin of the channel with permission to post, then try again.`
          : `Add @${bot.username} to the group, then try again.`,
      );
    }

    return this.accounts.connectAccount({
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      userId: params.userId,
      platform: 'telegram',
      accountName: chat.title || chat.username || `Chat ${chat.id}`,
      username: chat.username,
      externalId: String(chat.id),
      accessToken: token,
      metadata: {
        chat_id: String(chat.id),
        chat_type: chat.type,
        bot_username: bot.username,
      },
      connected: true,
    });
  }
}
