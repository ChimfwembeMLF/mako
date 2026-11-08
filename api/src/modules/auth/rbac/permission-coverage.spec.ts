/**
 * Pins the permission each sensitive route requires, so a guard can't be dropped
 * by accident. The TenantScopeInterceptor enforces whatever @RequirePermission sets.
 */
jest.mock('@mistralai/mistralai', () => ({}));
jest.mock('../../chatbot/utils/avatar-model-compress.util', () => ({}));
jest.mock('uuid', () => ({ v1: () => 'id', v4: () => 'id' }));

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';
import { LeadsController } from '../../leads/leads.controller';
import { MailController } from '../../mail/mail.controller';
import { ContentItemsController } from '../../content_items/content_items.controller';
import { ContentCampaignsController } from '../../content_campaigns/content-campaigns.controller';
import { TemplatesController } from '../../templates/templates.controller';
import { AuditLogsController } from '../../audit_logs/audit_logs.controller';
import { AnalyticsController } from '../../analytics/analytics.controller';
import { ApprovalRequestsController } from '../../approval_requests/approval_requests.controller';
import { ApprovalWorkflowsController } from '../../approval_workflows/approval_workflows.controller';
import { CommentRepliesController } from '../../comment_replies/comment_replies.controller';
import { SocialInboxController } from '../../social_inbox/social-inbox.controller';
import { WhatsappController } from '../../whatsapp/whatsapp.controller';
import { WhatsappContactsController } from '../../whatsapp_contacts/whatsapp_contacts.controller';
import { PaymentsController } from '../../payments/payments.controller';
import { SubscriptionsController } from '../../subscriptions/subscriptions.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor = { prototype: any; name: string };

/** The permission on the handler registered for this method and path. */
function permissionFor(
  controller: Ctor,
  method: keyof typeof RequestMethod,
  path: string,
): string | undefined | 'NO ROUTE' {
  const proto = controller.prototype as Record<string, unknown>;
  for (const name of Object.getOwnPropertyNames(proto)) {
    const handler = proto[name];
    if (typeof handler !== 'function' || name === 'constructor') continue;
    const routePath = Reflect.getMetadata(PATH_METADATA, handler);
    const routeMethod = Reflect.getMetadata(METHOD_METADATA, handler);
    if (routePath === undefined) continue;
    const normalized = Array.isArray(routePath) ? routePath[0] : routePath;
    if (
      routeMethod === RequestMethod[method] &&
      (normalized === path || (normalized === '/' && path === ''))
    ) {
      return Reflect.getMetadata(REQUIRED_PERMISSION_KEY, handler);
    }
  }
  return 'NO ROUTE';
}

const EXPECTED: Array<[Ctor, keyof typeof RequestMethod, string, string]> = [
  // Reading data needs the matching "view" permission, not just membership.
  [LeadsController, 'GET', '', 'leads.view'],
  [LeadsController, 'GET', ':id', 'leads.view'],
  [MailController, 'GET', 'inbox', 'leads.view'],
  [MailController, 'GET', 'drafts', 'leads.view'],
  [WhatsappContactsController, 'GET', '', 'leads.view'],
  [WhatsappContactsController, 'GET', ':id', 'leads.view'],
  [ContentItemsController, 'GET', '', 'content.view'],
  [ContentItemsController, 'GET', ':id', 'content.view'],
  [ContentItemsController, 'GET', ':id/details', 'content.view'],
  [ContentCampaignsController, 'GET', '', 'content.view'],
  [ContentCampaignsController, 'GET', ':id', 'content.view'],
  [TemplatesController, 'GET', ':id', 'templates.view'],
  [AuditLogsController, 'GET', '', 'audit.view'],
  [AuditLogsController, 'GET', ':id', 'audit.view'],
  [AnalyticsController, 'GET', 'platform-dashboard', 'analytics.view'],
  [AnalyticsController, 'GET', 'performance', 'analytics.view'],
  [AnalyticsController, 'GET', 'insights', 'analytics.view'],
  [AnalyticsController, 'GET', 'ai-report', 'analytics.view'],
  [ApprovalRequestsController, 'GET', '', 'approvals.view'],
  [ApprovalRequestsController, 'GET', ':id', 'approvals.view'],
  [CommentRepliesController, 'GET', 'inbox', 'replies.view'],
  [CommentRepliesController, 'GET', '', 'replies.view'],
  [CommentRepliesController, 'GET', ':id', 'replies.view'],
  [SocialInboxController, 'GET', 'conversations', 'replies.view'],
  [SocialInboxController, 'GET', 'messages', 'replies.view'],
  [WhatsappController, 'GET', 'messages', 'replies.view'],
  [WhatsappController, 'GET', 'conversations', 'replies.view'],
  [WhatsappController, 'GET', 'flows/sessions', 'chatbot.view'],
  // Changing the approval rules is the maker-checker admin's job.
  [ApprovalWorkflowsController, 'POST', '', 'admin.maker_checker'],
  [ApprovalWorkflowsController, 'PATCH', ':id', 'admin.maker_checker'],
  [ApprovalWorkflowsController, 'DELETE', ':id', 'admin.maker_checker'],
  // Money moves only with billing access.
  [PaymentsController, 'GET', 'deposits/tenant/:tenantId', 'settings.billing'],
  [
    PaymentsController,
    'GET',
    'deposits/:depositId/invoice',
    'settings.billing',
  ],
  [PaymentsController, 'POST', 'deposits/initiate', 'settings.billing'],
  [PaymentsController, 'POST', 'ads-deposit', 'settings.billing'],
  [
    PaymentsController,
    'POST',
    'deposits/:depositId/refund-request',
    'settings.billing',
  ],
  [
    SubscriptionsController,
    'PATCH',
    'tenant/:tenantId/auto-renew',
    'settings.billing',
  ],
];

describe('route permissions', () => {
  it.each(
    EXPECTED.map(
      ([c, m, p, perm]) =>
        [`${m} ${c.name} ${p || '/'}`, c, m, p, perm] as const,
    ),
  )(
    '%s requires the right permission',
    (_label, controller, method, path, permission) => {
      expect(permissionFor(controller, method, path)).toBe(permission);
    },
  );
});
