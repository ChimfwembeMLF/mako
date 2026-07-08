import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/* --------------------------------------------------------------
   Helper utilities
-------------------------------------------------------------- */
function toPascal(str: string): string {
  return str
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function toCamel(str: string): string {
  const pas = toPascal(str);
  return pas.charAt(0).toLowerCase() + pas.slice(1);
}

/* --------------------------------------------------------------
   Schema definition (add / remove tables as needed)
-------------------------------------------------------------- */
type Column = {
  name: string;
  type: string;
  primary?: boolean;
  generated?: boolean; // default: gen_random_uuid()
  nullable?: boolean;
  unique?: boolean;
  ref?: string; // e.g. '> tenants.id'
};

type Table = {
  name: string; // e.g. 'auth.users' or 'tenants'
  columns: Column[];
  indexes?: string[][]; // composite unique indexes
};

const tables: Table[] = [
  // ===================== TENANCY CORE =====================
  {
    name: 'auth.users',
    columns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'email', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'tenants',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'name', type: 'text' },
      { name: 'slug', type: 'text', unique: true },
      { name: 'logo_url', type: 'text', nullable: true },
      { name: 'owner_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'profiles',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'user_id', type: 'uuid', unique: true, ref: '> auth.users.id' },
      { name: 'display_name', type: 'text', nullable: true },
      { name: 'full_name', type: 'text', nullable: true },
      { name: 'avatar_url', type: 'text', nullable: true },
      { name: 'is_system_admin', type: 'boolean', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'tenant_members',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'role_id', type: 'uuid' },
      { name: 'is_active', type: 'boolean' },
      { name: 'invited_by', type: 'uuid', ref: '> auth.users.id' },
      { name: 'joined_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'user_id']],
  },
  {
    name: 'workspaces',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'name', type: 'text' },
      { name: 'slug', type: 'text' },
      { name: 'logo_url', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'slug']],
  },

  // ===================== RBAC =====================
  {
    name: 'permissions',
    columns: [
      { name: 'key', type: 'text', primary: true },
      { name: 'label', type: 'text' },
      { name: 'description', type: 'text', nullable: true },
      { name: 'module', type: 'text', nullable: true },
    ],
  },
  {
    name: 'roles',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'name', type: 'text' },
      { name: 'description', type: 'text', nullable: true },
      { name: 'is_system', type: 'boolean', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'name']],
  },
  {
    name: 'role_permissions',
    columns: [
      { name: 'role_id', type: 'uuid', ref: '> roles.id' },
      { name: 'permission_key', type: 'text', ref: '> permissions.key' },
    ],
    indexes: [['role_id', 'permission_key']],
  },
  {
    name: 'user_permissions',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'permission_key', type: 'text', ref: '> permissions.key' },
      { name: 'effect', type: 'text' }, // allow / deny
      { name: 'valid_from', type: 'timestamptz', nullable: true },
      { name: 'valid_until', type: 'timestamptz', nullable: true },
      { name: 'granted_by', type: 'uuid', ref: '> auth.users.id' },
      { name: 'reason', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [
      ['tenant_id', 'user_id', 'permission_key'],
      ['valid_until'],
    ],
  },

  // ===================== BRAND SYSTEM =====================
  {
    name: 'brand_profiles',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'company_name', type: 'text', nullable: true },
      { name: 'industry', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
      { name: 'services', type: 'text', nullable: true },
      { name: 'target_audience', type: 'text', nullable: true },
      { name: 'audience_pain_points', type: 'text', nullable: true },
      { name: 'tone_of_voice', type: 'text', nullable: true },
      { name: 'brand_personality', type: 'text', nullable: true },
      { name: 'current_offers', type: 'text', nullable: true },
      { name: 'unique_selling_points', type: 'text', nullable: true },
      { name: 'faqs', type: 'text', nullable: true },
      { name: 'case_studies', type: 'text', nullable: true },
      { name: 'banned_words', type: 'text', nullable: true },
      { name: 'banned_topics', type: 'text', nullable: true },
      { name: 'competitors', type: 'text', nullable: true },
      { name: 'keywords', type: 'text', nullable: true },
      { name: 'website_url', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
    indexes: [['tenant_id', 'user_id']],
  },

  // ===================== CONTENT SYSTEM =====================
  {
    name: 'content_items',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'workspace_id', type: 'uuid', ref: '> workspaces.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'brand_profile_id', type: 'uuid', ref: '> brand_profiles.id' },
      { name: 'content_type', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'content', type: 'text' },
      { name: 'campaign_theme', type: 'text', nullable: true },
      { name: 'status', type: 'text', nullable: true },
      { name: 'platforms', type: 'text[]', nullable: true },
      { name: 'platform_payloads', type: 'jsonb', nullable: true },
      { name: 'scheduled_date', type: 'date', nullable: true },
      { name: 'scheduled_time', type: 'timetz', nullable: true },
      { name: 'published_at', type: 'timestamptz', nullable: true },
      { name: 'external_post_id', type: 'text', nullable: true },
      { name: 'publish_failed_reason', type: 'text', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
    indexes: [
      ['tenant_id', 'status', 'scheduled_date'],
      ['workspace_id', 'status'],
    ],
  },

  // ===================== SOCIAL + AUTOMATION =====================
  {
    name: 'social_accounts',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'platform', type: 'text' },
      { name: 'account_name', type: 'text' },
      { name: 'connected', type: 'boolean' },
      { name: 'credentials', type: 'jsonb' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    name: 'auto_reply_rules',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'platform', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'trigger_keywords', type: 'text[]', nullable: true },
      { name: 'trigger_sentiment', type: 'text', nullable: true },
      { name: 'response_template', type: 'text', nullable: true },
      { name: 'ai_generate', type: 'boolean' },
      { name: 'is_active', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    name: 'comment_replies',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'content_id', type: 'uuid', ref: '> content_items.id' },
      { name: 'platform', type: 'text' },
      { name: 'external_comment_id', type: 'text' },
      { name: 'external_post_id', type: 'text' },
      { name: 'commenter_name', type: 'text' },
      { name: 'commenter_avatar_url', type: 'text', nullable: true },
      { name: 'comment_text', type: 'text' },
      { name: 'reply_text', type: 'text', nullable: true },
      { name: 'reply_type', type: 'text', nullable: true },
      { name: 'status', type: 'text', nullable: true },
      { name: 'rule_id', type: 'uuid', ref: '> auto_reply_rules.id', nullable: true },
      { name: 'sent_at', type: 'timestamptz', nullable: true },
      { name: 'parent_comment_id', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [
      ['content_id'],
      ['rule_id'],
    ],
  },

  // ===================== LEADS =====================
  {
    name: 'lead_sources',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'label', type: 'text' },
      { name: 'webhook_secret', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'user_id']],
  },
  {
    name: 'leads',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'source', type: 'text' },
      { name: 'message', type: 'text', nullable: true },
      { name: 'classification', type: 'text', nullable: true },
      { name: 'status', type: 'text', nullable: true },
      { name: 'ai_reply', type: 'text', nullable: true },
      { name: 'unsubscribed', type: 'boolean', nullable: true },
      { name: 'unsubscribe_token', type: 'text', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'status', 'created_at']],
  },

  // ===================== PAYMENTS =====================
  {
    name: 'deposits',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'deposit_id', type: 'text', unique: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'plan', type: 'text', nullable: true },
      { name: 'status', type: 'text', nullable: true },
      { name: 'amount', type: 'numeric', nullable: true },
      { name: 'currency', type: 'text', nullable: true },
      { name: 'correspondent', type: 'text', nullable: true },
      { name: 'msisdn', type: 'text', nullable: true },
      { name: 'phone', type: 'text', nullable: true },
      { name: 'provider', type: 'text', nullable: true },
      { name: 'raw_payload', type: 'jsonb', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'payment_failures',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'deposit_id', type: 'text' },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'provider', type: 'text', nullable: true },
      { name: 'reason', type: 'text', nullable: true },
      { name: 'raw_payload', type: 'jsonb', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },

  // ===================== APPROVAL WORKFLOWS =====================
  {
    name: 'approval_workflows',
    columns: [
      { name: 'action_key', type: 'text', primary: true },
      { name: 'label', type: 'text' },
      { name: 'description', type: 'text', nullable: true },
      { name: 'is_enabled', type: 'boolean' },
      { name: 'approver_role_id', type: 'uuid', ref: '> roles.id' },
      { name: 'updated_by', type: 'uuid', ref: '> auth.users.id' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'approval_requests',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'action_key', type: 'text', ref: '> approval_workflows.action_key' },
      { name: 'resource_type', type: 'text' },
      { name: 'resource_id', type: 'uuid' },
      { name: 'payload', type: 'jsonb', nullable: true },
      { name: 'requested_by', type: 'uuid', ref: '> auth.users.id' },
      { name: 'reviewed_by', type: 'uuid', ref: '> auth.users.id', nullable: true },
      { name: 'status', type: 'text' },
      { name: 'requester_notes', type: 'text', nullable: true },
      { name: 'reviewer_notes', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'reviewed_at', type: 'timestamptz', nullable: true },
    ],
    indexes: [
      ['status', 'created_at'],
      ['tenant_id', 'status'],
    ],
  },

  // ===================== WHATSAPP =====================
  {
    name: 'whatsapp_contacts',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'phone', type: 'text' },
      { name: 'name', type: 'text', nullable: true },
      { name: 'opted_in', type: 'boolean' },
      { name: 'opted_in_at', type: 'timestamptz', nullable: true },
      { name: 'tags', type: 'text[]', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'phone']],
  },

  // ===================== AUDIT + AI USAGE =====================
  {
    name: 'audit_logs',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'action', type: 'text' },
      { name: 'resource_type', type: 'text' },
      { name: 'resource_id', type: 'uuid' },
      { name: 'before_state', type: 'jsonb', nullable: true },
      { name: 'after_state', type: 'jsonb', nullable: true },
      { name: 'metadata', type: 'jsonb', nullable: true },
      { name: 'ip_address', type: 'text', nullable: true },
      { name: 'user_agent', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'created_at']],
  },
  {
    name: 'ai_usage',
    columns: [
      { name: 'id', type: 'uuid', primary: true, generated: true },
      { name: 'tenant_id', type: 'uuid', ref: '> tenants.id' },
      { name: 'user_id', type: 'uuid', ref: '> auth.users.id' },
      { name: 'function_name', type: 'text' },
      { name: 'tokens_used', type: 'int' },
      { name: 'created_at', type: 'timestamptz' },
    ],
    indexes: [['tenant_id', 'created_at']],
  },
];

/* --------------------------------------------------------------
   File system helpers
-------------------------------------------------------------- */
function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeFile(filePath: string, content: string) {
  ensureDir(join(filePath, '..'));
  writeFileSync(filePath, content, { encoding: 'utf8' });
}

/* --------------------------------------------------------------
   Code generators
-------------------------------------------------------------- */
function generateEntity(table: Table): string {
  const className = toPascal(table.name.replace('.', '_'));
  const imports = new Set<string>([
    'Entity',
    'PrimaryGeneratedColumn',
    'Column',
    'CreateDateColumn',
    'UpdateDateColumn',
    'DeleteDateColumn',
    'Index',
    'ManyToOne',
    'JoinColumn',
  ]);

  const lines: string[] = [];

  // Composite unique indexes
  if (table.indexes) {
    table.indexes.forEach((idx) => {
      lines.push(`@Index(['${idx.join("', '")}'], { unique: true })`);
    });
  }

  // Entity decorator
  lines.push(`@Entity({ name: '${table.name.replace('.', '_')}' })`);

  // Class start
  lines.push(`export class ${className} {`);

  // Primary key
  const pk = table.columns.find((c) => c.primary);
  if (pk) {
    const gen = pk.generated ? `'uuid'` : '';
    lines.push(
      `  @PrimaryGeneratedColumn(${gen})\n  ${toCamel(pk.name)}: string;`,
    );
  }

  // Other columns
  table.columns
    .filter((c) => !c.primary)
    .forEach((col) => {
      // special timestamp columns
      if (col.name === 'created_at') {
        lines.push(`  @CreateDateColumn({ type: 'timestamptz' })\n  created_at: Date;`);
        return;
      }
      if (col.name === 'updated_at') {
        lines.push(`  @UpdateDateColumn({ type: 'timestamptz' })\n  updated_at: Date;`);
        return;
      }
      if (col.name === 'deleted_at') {
        lines.push(`  @DeleteDateColumn({ type: 'timestamptz' })\n  deleted_at?: Date;`);
        return;
      }

      // regular column
      const opts: string[] = [];
      if (col.type === 'uuid') opts.push(`type: 'uuid'`);
      if (col.type === 'text') opts.push(`type: 'text'`);
      if (col.type === 'boolean') opts.push(`type: 'boolean'`);
      if (col.type === 'timestamptz') opts.push(`type: 'timestamptz'`);
      if (col.type === 'date') opts.push(`type: 'date'`);
      if (col.type === 'timetz') opts.push(`type: 'timetz'`);
      if (col.type === 'jsonb') opts.push(`type: 'jsonb'`);
      if (col.type === 'text[]') {
        opts.push(`type: 'text', array: true`);
      }
      if (col.nullable) opts.push('nullable: true');
      if (col.unique) opts.push('unique: true');

      const optStr = opts.length ? `{ ${opts.join(', ')} }` : '';
      const tsType = col.type.includes('[]')
        ? 'string[]'
        : col.type === 'uuid'
          ? 'string'
          : col.type === 'boolean'
            ? 'boolean'
            : col.type === 'timestamptz' || col.type === 'date' || col.type === 'timetz'
              ? 'Date'
              : 'string';

      lines.push(`  @Column(${optStr})\n  ${toCamel(col.name)}${col.nullable ? '?' : ''}: ${tsType};`);
    });

  // Relations for foreign keys (skip if already covered by column decorator)
  table.columns
    .filter((c) => c.ref)
    .forEach((col) => {
      const targetTable = col.ref!.split(' ')[1].split('.')[0];
      const targetEntity = toPascal(targetTable);
      const propName = toCamel(col.name.replace('_id', ''));
      lines.push(
        `  @ManyToOne(() => ${targetEntity}, { nullable: ${col.nullable ?? false} })\n  @JoinColumn({ name: '${col.name}' })\n  ${propName}: ${targetEntity};`,
      );
      imports.add('ManyToOne');
      imports.add('JoinColumn');
    });

  // Close class
  lines.push('}');

  const importLine = `import { ${Array.from(imports).join(', ')} } from 'typeorm';`;

  return `${importLine}\n\n${lines.join('\n')}\n`;
}

// DTO generators
function generateDto(table: Table, mode: 'create' | 'update'): string {
  const className = `${toPascal(table.name.replace('.', '_'))}${mode === 'create' ? 'CreateDto' : 'UpdateDto'
    }`;
  const imports = new Set<string>([
    'IsString',
    'IsOptional',
    'IsUUID',
    'IsBoolean',
    'IsDate',
    'IsArray',
    'IsNumber',
    'IsInt',
  ]);

  const lines: string[] = [];

  table.columns
    .filter((c) => !c.primary) // primary key omitted for create (auto‑gen)
    .forEach((col) => {
      const prop = toCamel(col.name);
      const validators: string[] = [];

      // Pick validator based on type
      if (col.type === 'uuid') validators.push('IsUUID()');
      else if (col.type === 'text') validators.push('IsString()');
      else if (col.type === 'boolean') validators.push('IsBoolean()');
      else if (col.type === 'timestamptz' || col.type === 'date' || col.type === 'timetz')
        validators.push('IsDate()');
      else if (col.type === 'text[]') {
        validators.push('IsArray()');
        validators.push('IsString({ each: true })');
      }

      // optional for update or nullable cols
      if (mode === 'update' || col.nullable) validators.unshift('IsOptional()');

      const tsType = col.type.includes('[]')
        ? 'string[]'
        : col.type === 'uuid'
          ? 'string'
          : col.type === 'boolean'
            ? 'boolean'
            : col.type === 'timestamptz' || col.type === 'date' || col.type === 'timetz'
              ? 'Date'
              : 'string';

      lines.push(
        `${validators.map((v) => `@${v}`).join('\n')}\n  ${prop}${mode === 'update' || col.nullable ? '?' : ''
        }: ${tsType};`,
      );
    });

  const importLine = `import { ${Array.from(imports).join(', ')} } from 'class-validator';`;

  return `${importLine}\n\nexport class ${className} {\n  ${lines.join('\n\n  ')}\n}\n`;
}

// Service generator (basic CRUD)
function generateService(table: Table): string {
  const className = `${toPascal(table.name.replace('.', '_'))}Service`;
  const entityName = toPascal(table.name.replace('.', '_'));
  const pk = table.columns.find((c) => c.primary);
  const pkProp = pk ? toCamel(pk.name) : 'id';

  return `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${entityName} } from './entities/${table.name.replace('.', '_')}.entity';
import { ${entityName}CreateDto } from './dto/create-${table.name.replace(
    '.',
    '-',
  )}.dto';
import { ${entityName}UpdateDto } from './dto/update-${table.name.replace(
    '.',
    '-',
  )}.dto';

@Injectable()
export class ${className} {
  constructor(
    @InjectRepository(${entityName})
    private readonly repo: Repository<${entityName}>,
  ) {}

  async create(dto: ${entityName}CreateDto): Promise<${entityName}> {
    const ent = this.repo.create(dto as any);
    return this.repo.save(ent);
  }

  async findAll(): Promise<${entityName}[]> {
    return this.repo.find();
  }

  async findOne(${pkProp}: string): Promise<${entityName}> {
    const ent = await this.repo.findOne({ where: { ${pkProp} } });
    if (!ent) throw new NotFoundException('${entityName} not found');
    return ent;
  }

  async update(${pkProp}: string, dto: ${entityName}UpdateDto): Promise<${entityName}> {
    await this.repo.update(${pkProp}, dto as any);
    return this.findOne(${pkProp});
  }

  async remove(${pkProp}: string): Promise<void> {
    const res = await this.repo.delete(${pkProp});
    if (res.affected === 0) throw new NotFoundException('${entityName} not found');
  }
}
`;
}

// Controller generator
function generateController(table: Table): string {
  const className = `${toPascal(table.name.replace('.', '_'))}Controller`;
  const serviceName = `${toPascal(table.name.replace('.', '_'))}Service`;
  const entityName = toPascal(table.name.replace('.', '_'));
  const pk = table.columns.find((c) => c.primary);
  const pkProp = pk ? toCamel(pk.name) : 'id';

  return `import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ${serviceName} } from './${table.name.replace('.', '-')}.service';
import { ${entityName} } from './entities/${table.name.replace('.', '_')}.entity';
import { ${entityName}CreateDto } from './dto/create-${table.name.replace(
    '.',
    '-',
  )}.dto';
import { ${entityName}UpdateDto } from './dto/update-${table.name.replace(
    '.',
    '-',
  )}.dto';

@Controller('${table.name.replace('.', '-')}')
export class ${className} {
  constructor(private readonly service: ${serviceName}) {}

  @Post()
  create(@Body() dto: ${entityName}CreateDto): Promise<${entityName}> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<${entityName}[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<${entityName}> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ${entityName}UpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
`;
}

// Module generator
function generateModule(table: Table): string {
  const entityName = toPascal(table.name.replace('.', '_'));
  const serviceName = `${entityName}Service`;
  const controllerName = `${entityName}Controller`;
  const moduleName = `${entityName}Module`;

  return `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${entityName} } from './entities/${table.name.replace('.', '_')}.entity';
import { ${serviceName} } from './${table.name.replace('.', '-')}.service';
import { ${controllerName} } from './${table.name.replace('.', '-')}.controller';

@Module({
  imports: [TypeOrmModule.forFeature([${entityName}])],
  providers: [${serviceName}],
  controllers: [${controllerName}],
  exports: [${serviceName}],
})
export class ${moduleName} {}
`;
}

/* --------------------------------------------------------------
   Generation loop
-------------------------------------------------------------- */
const BASE_DIR = join(process.cwd(), 'src', 'modules');

tables.forEach((table) => {
  const basePath = join(BASE_DIR, table.name.replace('.', '-'));

  // Entity
  const entityDir = join(basePath, 'entities');
  writeFile(
    join(entityDir, `${table.name.replace('.', '_')}.entity.ts`),
    generateEntity(table),
  );

  // DTOs
  const dtoDir = join(basePath, 'dto');
  writeFile(
    join(dtoDir, `create-${table.name.replace('.', '-')}.dto.ts`),
    generateDto(table, 'create'),
  );
  writeFile(
    join(dtoDir, `update-${table.name.replace('.', '-')}.dto.ts`),
    generateDto(table, 'update'),
  );

  // Service
  writeFile(
    join(basePath, `${table.name.replace('.', '-')}.service.ts`),
    generateService(table),
  );

  // Controller
  writeFile(
    join(basePath, `${table.name.replace('.', '-')}.controller.ts`),
    generateController(table),
  );

  // Module
  writeFile(
    join(basePath, `${table.name.replace('.', '-')}.module.ts`),
    generateModule(table),
  );

  console.log(`✅ Generated ${table.name}`);
});

/* --------------------------------------------------------------
   Supabase auth scaffolding (minimal)
-------------------------------------------------------------- */
const authDir = join(process.cwd(), 'src', 'auth');
ensureDir(authDir);

// supabase.provider.ts
writeFile(
  join(authDir, 'supabase.provider.ts'),
  `import { createClient } from '@supabase/supabase-js';
import { Provider } from '@nestjs/common';

export const SupabaseClientProvider: Provider = {
  provide: 'SUPABASE_CLIENT',
  useFactory: () => {
    const url = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    return createClient(url, anonKey);
  },
};\n`,
);

// supabase.guard.ts
writeFile(
  join(authDir, 'supabase.guard.ts'),
  `import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, verify } from 'jsonwebtoken';
import { Request } from 'express';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Missing Authorization header');

    const token = authHeader.split(' ')[1];
    const publicKey = this.config.get<string>('SUPABASE_JWT_PUBLIC_KEY');
    try {
      const payload = verify(token, publicKey!) as JwtPayload;
      (request as any).user = payload; // expose to controllers
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Supabase JWT');
    }
  }
}\n`,
);

// Update (or create) auth.module.ts to export the guard/provider
const authModulePath = join(authDir, 'auth.module.ts');
writeFile(
  authModulePath,
  `import { Module } from '@nestjs/common';
import { SupabaseClientProvider } from './supabase.provider';
import { SupabaseAuthGuard } from './supabase.guard';

@Module({
  providers: [SupabaseClientProvider, SupabaseAuthGuard],
  exports: [SupabaseClientProvider, SupabaseAuthGuard],
})
export class AuthModule {}\n`,
);

console.log('✅ Supabase auth scaffolding added');

