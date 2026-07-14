import {
  brandProfilesApi,
  contentAiApi,
  paymentsApi,
  leadsApi,
  commentRepliesApi,
  resolveQueued,
} from '@/lib/api';

type EdgeBody = Record<string, unknown> | undefined;

function activeTenantId(): string | undefined {
  return localStorage.getItem('brandpilot_active_tenant') ?? undefined;
}

async function runHandler<T>(
  fn: () => Promise<T>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err: unknown) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}

async function runQueued<T extends { queued?: boolean }>(
  fn: () => Promise<T>,
): Promise<unknown> {
  const response = await fn();
  return resolveQueued(response);
}

/** Routes legacy edge function names to Nest API endpoints. */
export async function invokeEdgeFunction(
  name: string,
  options?: { body?: EdgeBody },
): Promise<{ data: unknown; error: { message: string } | null }> {
  const body = options?.body ?? {};
  const tenantId = (body.tenantId as string | undefined) ?? (body.tenant_id as string | undefined) ?? activeTenantId();

  switch (name) {
    case 'generate-content':
      return runHandler(() =>
        runQueued(() =>
          contentAiApi.generate({
            theme: body.theme as string | undefined,
            draft: body.draft as string | undefined,
            workspaceId: (body.workspaceId ?? body.workspace_id) as string | undefined,
            tenantId,
            contentType: body.contentType as string | undefined,
            platform: body.platform as string | undefined,
            templateId: body.templateId as string | undefined,
            save: body.contentType === 'reply' ? false : (body.save as boolean | undefined) ?? false,
          }),
        ),
      );

    case 'generate-image':
      if (!tenantId) return { data: null, error: { message: 'tenantId is required for image generation' } };
      return runHandler(() =>
        runQueued(() =>
          contentAiApi.generateImage({
            prompt: String(body.prompt ?? ''),
            tenantId,
            contentId: body.contentId as string | undefined,
            contentType: body.contentType as string | undefined,
          }),
        ),
      );

    case 'generate-slideshow':
      if (!tenantId) return { data: null, error: { message: 'tenantId is required for slideshow generation' } };
      return runHandler(() =>
        runQueued(() =>
          contentAiApi.generateSlideshow({
            theme: String(body.theme ?? body.prompt ?? 'brand showcase'),
            tenantId,
            slideCount: body.slideCount as number | undefined,
            contentId: body.contentId as string | undefined,
          }),
        ),
      );

    case 'repurpose-content':
      return runHandler(() =>
        runQueued(() => contentAiApi.repurpose(String(body.contentId ?? ''))),
      );

    case 'publish-content': {
      const contentId = String(body.contentId ?? '');
      const platforms = body.platforms as string[] | undefined;
      const platformPayloads = body.platformPayloads as Record<string, unknown> | undefined;
      return runHandler(async () => {
        const result = (await runQueued(() =>
          contentAiApi.publish(contentId, platforms, platformPayloads),
        )) as { published?: boolean; results?: Record<string, { published: boolean; message: string }> };
        if (!result?.published) {
          const details = Object.entries(result?.results ?? {})
            .map(([p, r]) => `${p}: ${r.message}`)
            .join('\n');
          throw new Error(details || 'Publish failed');
        }
        return { message: 'Published successfully', ...result };
      });
    }

    case 'daily-content-workflow':
      return runHandler(() =>
        runQueued(() =>
          contentAiApi.dailyWorkflow(
            tenantId,
            (body.workspaceId ?? body.workspace_id) as string | undefined,
          ),
        ),
      );

    case 'auto-publish':
      return runHandler(() => runQueued(() => contentAiApi.autoPublish()));

    case 'scrape-brand':
      if (!tenantId) return { data: null, error: { message: 'tenantId is required for scraping' } };
      return runHandler(() =>
        brandProfilesApi.scrapeWebsite({ url: String(body.url ?? ''), tenantId }),
      );

    case 'initiate-payment':
      if (!tenantId) return { data: null, error: { message: 'tenantId is required' } };
      return runHandler(() =>
        paymentsApi.initiateDeposit({
          tenantId,
          plan: String(body.plan ?? 'starter'),
          phone: body.phone as string | undefined,
          correspondent: body.correspondent as string | undefined,
        }),
      );

    case 'create-checkout':
      if (!tenantId) return { data: null, error: { message: 'tenantId is required' } };
      return runHandler(async () => {
        const result = await paymentsApi.initiateDeposit({
          tenantId,
          plan: String(body.plan ?? 'starter'),
        });
        return {
          authorization_url: `/billing?deposit=${result.paymentId}`,
          message: result.message,
        };
      });

    case 'check-pending-payments':
      return runHandler(() => paymentsApi.checkPending());

    case 'send-lead-email':
      return runHandler(() =>
        runQueued(() =>
          leadsApi.sendEmail({
            to: body.to as string | undefined,
            leadId: body.leadId as string | undefined,
            subject: String(body.subject ?? 'Lead follow-up'),
            body: body.body as string | undefined,
            htmlBody: (body.htmlBody ?? body.html_body) as string | undefined,
            message: body.message as string | undefined,
          }),
        ),
      );

    case 'lead-webhook':
      return {
        data: null,
        error: {
          message: 'Use POST /api/v1/leads/webhook with sourceId and X-Webhook-Secret header',
        },
      };

    case 'fetch-comments': {
      const tid =
        (body.tenantId as string | undefined) ??
        (body.tenant_id as string | undefined) ??
        activeTenantId();
      if (!tid) return { data: null, error: { message: 'tenantId is required' } };
      return runHandler(() => runQueued(() => commentRepliesApi.fetch(tid)));
    }

    case 'suggest-comment-reply': {
      const commentId = String(body.commentReplyId ?? body.commentId ?? '');
      if (!commentId) return { data: null, error: { message: 'commentReplyId is required' } };
      return runHandler(() => runQueued(() => commentRepliesApi.suggest(commentId)));
    }

    case 'parse-brand-document':
      return {
        data: null,
        error: { message: 'Use brandProfilesApi.parseDocument(file, tenantId)' },
      };

    default:
      return {
        data: null,
        error: { message: `"${name}" is not available yet. This feature requires a backend endpoint.` },
      };
  }
}

export { resolveQueued } from '@/lib/api';
