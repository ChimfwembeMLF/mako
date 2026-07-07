import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappFlowSession } from './entities/whatsapp_flow_session.entity';
import { WhatsappFlowConfig } from './entities/whatsapp_flow_config.entity';
import { normalizeMenuItems } from './whatsapp-menu.types';
import { UpdateWhatsappFlowConfigDto } from './dto/update-whatsapp-flow-config.dto';
import { scopeWhere } from '../../common/workspace-scope.util';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WhatsappFlowSessionService {
  constructor(
    @InjectRepository(WhatsappFlowSession)
    private readonly sessions: Repository<WhatsappFlowSession>,
    @InjectRepository(WhatsappFlowConfig)
    private readonly configs: Repository<WhatsappFlowConfig>,
  ) {}

  async getConfig(
    tenantId: string,
    workspaceId?: string,
  ): Promise<WhatsappFlowConfig> {
    if (workspaceId) {
      let config = await this.configs.findOne({ where: { workspaceId } });
      if (!config) {
        config = await this.configs.save(
          this.configs.create({
            tenantId,
            workspaceId,
            enabled: false,
            flowType: 'configurable_menu',
            menuItems: [],
          }),
        );
      }
      config.menuItems = normalizeMenuItems(config.menuItems);
      return config;
    }

    let config = await this.configs.findOne({
      where: scopeWhere<WhatsappFlowConfig>(tenantId),
    });
    if (!config) {
      config = await this.configs.save(
        this.configs.create({
          tenantId,
          enabled: false,
          flowType: 'configurable_menu',
          menuItems: [],
        }),
      );
    }
    config.menuItems = normalizeMenuItems(config.menuItems);
    return config;
  }

  async updateConfig(
    tenantId: string,
    patch: UpdateWhatsappFlowConfigDto,
    workspaceId?: string,
  ): Promise<WhatsappFlowConfig> {
    const config = await this.getConfig(tenantId, workspaceId);

    if (patch.enabled !== undefined) config.enabled = patch.enabled;
    if (patch.serviceName !== undefined)
      config.serviceName = patch.serviceName.trim() || 'MyService';
    if (patch.welcomeMessage !== undefined) {
      config.welcomeMessage = patch.welcomeMessage.trim() || undefined;
    }
    if (patch.welcomeTriggers !== undefined) {
      config.welcomeTriggers = patch.welcomeTriggers
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }
    if (patch.menuItems !== undefined) {
      config.menuItems = normalizeMenuItems(patch.menuItems);
    }
    if (patch.aiFallbackEnabled !== undefined) {
      config.aiFallbackEnabled = patch.aiFallbackEnabled;
    }

    config.flowType = 'configurable_menu';
    return this.configs.save(config);
  }

  async getSession(
    tenantId: string,
    phone: string,
  ): Promise<WhatsappFlowSession | null> {
    const session = await this.sessions.findOne({ where: { tenantId, phone } });
    if (!session) return null;
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      await this.sessions.delete(session.id);
      return null;
    }
    return session;
  }

  async saveSession(
    tenantId: string,
    phone: string,
    state: string,
    context: Record<string, unknown>,
  ): Promise<WhatsappFlowSession> {
    const existing = await this.sessions.findOne({
      where: { tenantId, phone },
    });
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    if (existing) {
      existing.currentState = state;
      existing.context = context;
      existing.expiresAt = expiresAt;
      return this.sessions.save(existing);
    }

    return this.sessions.save(
      this.sessions.create({
        tenantId,
        phone,
        currentState: state,
        context,
        expiresAt,
      }),
    );
  }

  async clearSession(tenantId: string, phone: string): Promise<void> {
    await this.sessions.delete({ tenantId, phone });
  }

  async listSessions(
    tenantId: string,
    workspaceId?: string,
  ): Promise<WhatsappFlowSession[]> {
    const where: Record<string, unknown> = { tenantId };
    if (workspaceId) where.workspaceId = workspaceId;
    const now = new Date();
    const rows = await this.sessions.find({
      where,
      order: { updated_at: 'DESC' },
    });
    // filter expired ones out
    return rows.filter((s) => !s.expiresAt || s.expiresAt > now);
  }
}
