import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ChatApiKeyService } from '../services/chat-api-key.service';

@Injectable()
export class WidgetApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ChatApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      widgetAuth?: Awaited<
        ReturnType<ChatApiKeyService['validateBearerToken']>
      >;
    }>();

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('API key required');
    }

    req.widgetAuth = await this.apiKeys.validateBearerToken(auth);
    return true;
  }
}
