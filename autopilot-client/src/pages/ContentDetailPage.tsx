import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, Pencil, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { contentItemsApi } from '@/lib/api';
import { platformOf, type PlatformPayload } from '@/lib/platforms';

type Publication = {
  id: string;
  platform: string;
  status: string;
  publishedContent: string;
  publishedTitle?: string;
  publishedMedia?: Array<{ url: string; type?: string; name?: string }>;
  externalPostId?: string;
  errorMessage?: string;
  publishedAt?: string;
  created_at?: string;
};

type MediaAsset = {
  id: string;
  mediaUrl: string;
  mediaType?: string;
  name?: string;
};

type ContentDetails = {
  item: {
    id: string;
    title?: string;
    content?: string;
    status?: string;
    platforms?: string[];
    platformPayloads?: Record<string, PlatformPayload>;
    campaignTheme?: string;
    created_at?: string;
    publishedAt?: string;
  };
  publications: Publication[];
  media: MediaAsset[];
};

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

function MediaGrid({ items }: { items: Array<{ url: string; type?: string; name?: string }> }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((m, i) => (
        <a
          key={`${m.url}-${i}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border bg-muted/30 hover:ring-2 hover:ring-primary/30 transition-all"
        >
          {m.type?.startsWith('video') || m.url.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
            <video src={m.url} className="h-24 w-24 object-cover" muted />
          ) : (
            <img src={m.url} alt={m.name ?? 'media'} className="h-24 w-24 object-cover" />
          )}
        </a>
      ))}
    </div>
  );
}

function PlatformSection({
  platform,
  publications,
  draft,
}: {
  platform: string;
  publications: Publication[];
  draft?: PlatformPayload;
}) {
  const plat = platformOf(platform);
  const Icon = plat.icon;
  const latest = publications[0];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${plat.color}18` }}
          >
            <Icon size={16} style={{ color: plat.color }} />
          </span>
          <div>
            <p className="text-sm font-semibold">{plat.label}</p>
            <p className="text-xs text-muted-foreground">
              {publications.length
                ? `${publications.length} publication attempt${publications.length > 1 ? 's' : ''}`
                : 'Not published yet'}
            </p>
          </div>
        </div>
        {latest && (
          <Badge variant={statusVariant(latest.status)} className="capitalize">
            {latest.status}
          </Badge>
        )}
      </div>

      {latest ? (
        <div className="space-y-2">
          {latest.publishedTitle && (
            <p className="text-sm font-medium">{latest.publishedTitle}</p>
          )}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {plainText(latest.publishedContent)}
          </p>
          <MediaGrid items={latest.publishedMedia ?? []} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
            {latest.publishedAt && (
              <span>Published {new Date(latest.publishedAt).toLocaleString()}</span>
            )}
            {latest.externalPostId && (
              <span className="inline-flex items-center gap-1">
                Post ID: <code className="text-[11px] bg-muted px-1 rounded">{latest.externalPostId}</code>
              </span>
            )}
          </div>
          {latest.status === 'failed' && latest.errorMessage && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {latest.errorMessage}
            </p>
          )}
        </div>
      ) : draft ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Draft (not posted)</p>
          {draft.title && <p className="text-sm font-medium">{draft.title}</p>}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {plainText(draft.content ?? '')}
          </p>
          <MediaGrid items={draft.media ?? []} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No content prepared for this platform.</p>
      )}

      {publications.length > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-primary hover:underline">
            View {publications.length - 1} earlier attempt{publications.length > 2 ? 's' : ''}
          </summary>
          <div className="mt-3 space-y-3 border-t pt-3">
            {publications.slice(1).map((pub) => (
              <div key={pub.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(pub.status)} className="capitalize text-[10px]">
                    {pub.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(pub.publishedAt ?? pub.created_at ?? '').toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-3">{plainText(pub.publishedContent)}</p>
                {pub.errorMessage && (
                  <p className="text-destructive">{pub.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ContentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    contentItemsApi
      .getDetails(id)
      .then((res) => {
        setData(res as ContentDetails);
        setError(null);
      })
      .catch(() => setError('Content not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const platforms = useMemo(() => {
    if (!data) return [];
    const fromItem = data.item.platforms ?? [];
    const fromPubs = data.publications.map((p) => p.platform);
    const fromDrafts = Object.keys(data.item.platformPayloads ?? {});
    return [...new Set([...fromItem, ...fromPubs, ...fromDrafts])];
  }, [data]);

  const pubsByPlatform = useMemo(() => {
    const map: Record<string, Publication[]> = {};
    for (const pub of data?.publications ?? []) {
      if (!map[pub.platform]) map[pub.platform] = [];
      map[pub.platform].push(pub);
    }
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading content…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <p className="text-muted-foreground">{error ?? 'Content not found'}</p>
        <Button asChild variant="outline">
          <Link to="/content">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to content
          </Link>
        </Button>
      </div>
    );
  }

  const { item, media } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground">
            <Link to="/content">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Content
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{item.title || 'Untitled content'}</h1>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            {item.status && (
              <Badge variant="secondary" className="capitalize">
                {item.status}
              </Badge>
            )}
            {item.created_at && (
              <span>Created {new Date(item.created_at).toLocaleString()}</span>
            )}
            {item.publishedAt && (
              <span>· Last published {new Date(item.publishedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/content?edit=${item.id}`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to={`/content?publish=${item.id}`}>
              <Send className="h-4 w-4 mr-1" />
              Publish
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Master draft</p>
        {item.campaignTheme && (
          <p className="text-sm text-muted-foreground">{plainText(item.campaignTheme)}</p>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{plainText(item.content ?? '')}</p>
        {media.length > 0 && (
          <MediaGrid
            items={media.map((m) => ({
              url: m.mediaUrl,
              type: m.mediaType,
              name: m.name,
            }))}
          />
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Platform posts</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            What was sent to each channel
          </span>
        </div>

        {platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
            No platforms selected yet. Edit this content to choose platforms and publish.
          </p>
        ) : (
          <div className="grid gap-4">
            {platforms.map((platform) => (
              <PlatformSection
                key={platform}
                platform={platform}
                publications={pubsByPlatform[platform] ?? []}
                draft={item.platformPayloads?.[platform]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
