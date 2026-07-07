import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import {
  WhatsappTemplate,
  TemplateComponent,
  TemplateVariable,
} from './entities/whatsapp_template.entity';
import { CreateWhatsappTemplateDto } from './dto/create-whatsapp-template.dto';
import { UpdateWhatsappTemplateDto } from './dto/update-whatsapp-template.dto';
import { WhatsappCredentials } from '../whatsapp/whatsapp-platform.util';

const GRAPH_VERSION = 'v19.0';

@Injectable()
export class WhatsappTemplatesService {
  private readonly logger = new Logger(WhatsappTemplatesService.name);

  constructor(
    @InjectRepository(WhatsappTemplate)
    private readonly repo: Repository<WhatsappTemplate>,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateWhatsappTemplateDto): Promise<WhatsappTemplate> {
    const name = this.sanitizeName(dto.name);
    const tpl = this.repo.create({
      tenantId: dto.tenantId,
      workspaceId: dto.workspaceId,
      name,
      language: dto.language ?? 'en',
      category: dto.category ?? 'UTILITY',
      status: 'DRAFT',
      components: dto.components ?? [],
      variables: dto.variables ?? this.extractVariables(dto.components ?? []),
    });
    return this.repo.save(tpl);
  }

  findByTenant(
    tenantId: string,
    workspaceId?: string,
  ): Promise<WhatsappTemplate[]> {
    const where: Record<string, unknown> = { tenantId };
    if (workspaceId) where.workspaceId = workspaceId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, tenantId: string): Promise<WhatsappTemplate> {
    const tpl = await this.repo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('WhatsApp template not found');
    return tpl;
  }

  async update(
    id: string,
    dto: UpdateWhatsappTemplateDto,
    tenantId: string,
  ): Promise<WhatsappTemplate> {
    const tpl = await this.findOne(id, tenantId);
    if (tpl.status !== 'DRAFT' && tpl.status !== 'REJECTED') {
      throw new BadRequestException(
        'Only DRAFT or REJECTED templates can be edited. Duplicate it first.',
      );
    }
    if (dto.name) tpl.name = this.sanitizeName(dto.name);
    if (dto.language) tpl.language = dto.language;
    if (dto.category) tpl.category = dto.category;
    if (dto.components) {
      tpl.components = dto.components;
      tpl.variables =
        dto.variables ?? this.extractVariables(dto.components);
    }
    if (dto.variables) tpl.variables = dto.variables;
    tpl.status = 'DRAFT';
    tpl.rejectionReason = undefined;
    return this.repo.save(tpl);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const tpl = await this.findOne(id, tenantId);
    if (tpl.status === 'PENDING') {
      throw new BadRequestException(
        'Cannot delete a PENDING template. Wait for Meta to approve or reject it first.',
      );
    }
    await this.repo.remove(tpl);
  }

  // ─── Meta Submission ─────────────────────────────────────────────────────

  async submit(
    id: string,
    tenantId: string,
    creds: WhatsappCredentials,
  ): Promise<WhatsappTemplate> {
    const tpl = await this.findOne(id, tenantId);
    if (!['DRAFT', 'REJECTED'].includes(tpl.status)) {
      throw new BadRequestException(
        `Template is ${tpl.status} — only DRAFT or REJECTED templates can be submitted.`,
      );
    }
    if (!tpl.components.length) {
      throw new BadRequestException(
        'Template must have at least a BODY component before submitting.',
      );
    }

    const wabaId = await this.resolveWabaId(creds);
    if (!wabaId) {
      throw new BadRequestException(
        'Could not resolve WhatsApp Business Account ID from your credentials.',
      );
    }

    try {
      const { data } = await axios.post<{ id?: string }>(
        `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
        {
          name: tpl.name,
          language: tpl.language,
          category: tpl.category,
          components: tpl.components,
        },
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );

      tpl.metaTemplateId = data.id;
      tpl.status = 'PENDING';
      tpl.rejectionReason = undefined;
      tpl.syncedAt = new Date();
      return this.repo.save(tpl);
    } catch (err: unknown) {
      const msg = this.formatGraphError(err);
      this.logger.error(`Template submit failed (${tpl.name}): ${msg}`);
      throw new BadRequestException(`Meta rejected the submission: ${msg}`);
    }
  }

  // ─── Status Sync ─────────────────────────────────────────────────────────

  async syncStatus(
    id: string,
    tenantId: string,
    creds: WhatsappCredentials,
  ): Promise<WhatsappTemplate> {
    const tpl = await this.findOne(id, tenantId);
    if (!tpl.metaTemplateId && !tpl.name) {
      throw new BadRequestException('Template has never been submitted to Meta.');
    }
    await this.refreshFromMeta(tpl, creds);
    return this.repo.save(tpl);
  }

  async syncAll(
    tenantId: string,
    creds: WhatsappCredentials,
    workspaceId?: string,
  ): Promise<{ synced: number; errors: number }> {
    const templates = await this.findByTenant(tenantId, workspaceId);
    const pending = templates.filter((t) =>
      ['PENDING', 'APPROVED'].includes(t.status),
    );
    let synced = 0;
    let errors = 0;
    for (const tpl of pending) {
      try {
        await this.refreshFromMeta(tpl, creds);
        await this.repo.save(tpl);
        synced++;
      } catch {
        errors++;
      }
    }
    return { synced, errors };
  }

  // ─── List from Meta ───────────────────────────────────────────────────────

  async listFromMeta(creds: WhatsappCredentials): Promise<
    Array<{
      metaId: string;
      name: string;
      language: string;
      status: string;
      category?: string;
      components: TemplateComponent[];
    }>
  > {
    const wabaId = await this.resolveWabaId(creds);
    if (!wabaId) return [];
    try {
      const { data } = await axios.get<{
        data?: Array<{
          id?: string;
          name?: string;
          language?: string;
          status?: string;
          category?: string;
          components?: TemplateComponent[];
        }>;
      }>(
        `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
        {
          params: {
            access_token: creds.accessToken,
            limit: 100,
            fields: 'id,name,language,status,category,components',
          },
        },
      );
      return (data.data ?? [])
        .filter((t) => t.name)
        .map((t) => ({
          metaId: t.id ?? '',
          name: t.name!,
          language: t.language ?? 'en',
          status: t.status ?? 'UNKNOWN',
          category: t.category,
          components: (t.components ?? []) as TemplateComponent[],
        }));
    } catch (err) {
      this.logger.warn(`listFromMeta failed: ${this.formatGraphError(err)}`);
      return [];
    }
  }

  /** Import a Meta template into local registry as APPROVED */
  async importFromMeta(
    tenantId: string,
    workspaceId: string | undefined,
    metaTemplate: {
      metaId: string;
      name: string;
      language: string;
      status: string;
      category?: string;
      components: TemplateComponent[];
    },
  ): Promise<WhatsappTemplate> {
    const existing = await this.repo.findOne({
      where: { tenantId, name: metaTemplate.name, language: metaTemplate.language },
    });
    if (existing) {
      existing.metaTemplateId = metaTemplate.metaId;
      existing.status = metaTemplate.status as WhatsappTemplate['status'];
      existing.components = metaTemplate.components;
      existing.variables = this.extractVariables(metaTemplate.components);
      existing.syncedAt = new Date();
      return this.repo.save(existing);
    }
    const tpl = this.repo.create({
      tenantId,
      workspaceId,
      name: metaTemplate.name,
      language: metaTemplate.language,
      category: (metaTemplate.category as WhatsappTemplate['category']) ?? 'UTILITY',
      status: metaTemplate.status as WhatsappTemplate['status'],
      components: metaTemplate.components,
      variables: this.extractVariables(metaTemplate.components),
      metaTemplateId: metaTemplate.metaId,
      syncedAt: new Date(),
    });
    return this.repo.save(tpl);
  }

  // ─── Build Send Payload ───────────────────────────────────────────────────

  /**
   * Build a full Meta template message payload with variable substitution.
   * @param tpl   The template record
   * @param vars  Map of variable key → value (e.g. { customer_name: 'Alice' })
   */
  buildSendPayload(
    tpl: WhatsappTemplate,
    vars: Record<string, string>,
  ): Record<string, unknown> {
    const components: Record<string, unknown>[] = [];

    for (const comp of tpl.components) {
      if (comp.type === 'HEADER') {
        const headerVars = tpl.variables.filter((v) => v.component === 'HEADER');
        if (headerVars.length) {
          components.push({
            type: 'header',
            parameters: headerVars.map((v) => ({
              type: 'text',
              text: vars[v.key] ?? v.example ?? `{{${v.position}}}`,
            })),
          });
        }
      }

      if (comp.type === 'BODY') {
        const bodyVars = tpl.variables.filter((v) => v.component === 'BODY');
        if (bodyVars.length) {
          components.push({
            type: 'body',
            parameters: bodyVars.map((v) => ({
              type: 'text',
              text: vars[v.key] ?? v.example ?? `{{${v.position}}}`,
            })),
          });
        }
      }

      if (comp.type === 'BUTTONS') {
        (comp.buttons ?? []).forEach((btn, idx) => {
          if (btn.type === 'QUICK_REPLY') {
            components.push({
              type: 'button',
              sub_type: 'quick_reply',
              index: String(idx),
              parameters: [{ type: 'payload', payload: btn.text }],
            });
          }
        });
      }
    }

    return {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: tpl.name,
        language: { code: tpl.language },
        ...(components.length ? { components } : {}),
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async refreshFromMeta(
    tpl: WhatsappTemplate,
    creds: WhatsappCredentials,
  ) {
    const wabaId = await this.resolveWabaId(creds);
    if (!wabaId) return;
    try {
      const { data } = await axios.get<{
        data?: Array<{
          status?: string;
          rejected_reason?: string;
          components?: TemplateComponent[];
        }>;
      }>(
        `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
        {
          params: {
            access_token: creds.accessToken,
            name: tpl.name,
            fields: 'status,rejected_reason,components',
          },
        },
      );
      const record = data.data?.[0];
      if (record) {
        tpl.status = (record.status as WhatsappTemplate['status']) ?? tpl.status;
        tpl.rejectionReason = record.rejected_reason ?? undefined;
        if (record.components?.length) tpl.components = record.components;
      }
      tpl.syncedAt = new Date();
    } catch (err) {
      this.logger.warn(
        `Sync status failed for template ${tpl.name}: ${this.formatGraphError(err)}`,
      );
    }
  }

  private async resolveWabaId(
    creds: WhatsappCredentials,
  ): Promise<string | null> {
    try {
      const { data } = await axios.get<{
        whatsapp_business_account?: { id?: string };
      }>(
        `https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}`,
        {
          params: {
            fields: 'whatsapp_business_account',
            access_token: creds.accessToken,
          },
        },
      );
      return data.whatsapp_business_account?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Extract {{N}} variable placeholders from component text */
  private extractVariables(components: TemplateComponent[]): TemplateVariable[] {
    const vars: TemplateVariable[] = [];
    const regex = /\{\{(\d+)\}\}/g;

    for (const comp of components) {
      if (!['HEADER', 'BODY'].includes(comp.type)) continue;
      const text = comp.text ?? '';
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const pos = parseInt(match[1], 10);
        if (!vars.find((v) => v.component === comp.type && v.position === pos)) {
          vars.push({
            key: `${comp.type.toLowerCase()}_var_${pos}`,
            position: pos,
            component: comp.type as 'HEADER' | 'BODY',
            example: '',
          });
        }
      }
      regex.lastIndex = 0;
    }
    return vars;
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 512);
  }

  private formatGraphError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const d = err.response?.data as { error?: { message?: string; code?: number } };
      if (d?.error?.message) return `#${d.error.code ?? '?'} ${d.error.message}`;
      return err.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
