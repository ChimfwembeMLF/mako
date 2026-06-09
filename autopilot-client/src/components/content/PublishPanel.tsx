import { useEffect, useState } from 'react';
import { Send, Loader2, X, Link2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { contentItemsApi, socialAccountsApi, SocialAccount } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { buildPlatformPayloads, platformOf, PlatformPayload } from '@/lib/platforms';
import { MultiPlatformPicker } from './MultiPlatformPicker';
import { PlatformPreviewCarousel } from './PlatformPreviewCarousel';
import { ContentItem } from './types';

interface PublishPanelProps {
  item: ContentItem;
  onCancel: () => void;
  onPublished: () => void;
}

export function PublishPanel({ item, onCancel, onPublished }: PublishPanelProps) {
  const { toast } = useToast();
  const { tenant } = useTenant();

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformPayloads, setPlatformPayloads] = useState<Record<string, PlatformPayload>>({});
  const [publishing, setPublishing] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    socialAccountsApi.findByTenant(tenant.id).then((data) => {
      setConnectedAccounts(Array.isArray(data) ? data : []);
    }).catch(() => setConnectedAccounts([]));
  }, [tenant?.id]);

  useEffect(() => {
    const existing = item.platforms?.length ? item.platforms : [];
    setSelectedPlatforms(existing);
    if (item.platformPayloads && Object.keys(item.platformPayloads).length) {
      setPlatformPayloads(item.platformPayloads);
    } else if (existing.length) {
      setPlatformPayloads(buildPlatformPayloads(item.content ?? '', item.title ?? '', existing));
    } else {
      setPlatformPayloads({});
    }
  }, [item]);

  useEffect(() => {
    if (!selectedPlatforms.length) {
      setPlatformPayloads({});
      return;
    }
    setPlatformPayloads((prev) => {
      const next = buildPlatformPayloads(item.content ?? '', item.title ?? '', selectedPlatforms);
      for (const p of selectedPlatforms) {
        if (prev[p]?.content) next[p] = { ...next[p], content: prev[p].content };
      }
      return next;
    });
  }, [selectedPlatforms.join(','), item.content, item.title]);

  const updatePayload = (platform: string, patch: Partial<PlatformPayload>) => {
    setPlatformPayloads((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], ...patch },
    }));
  };

  const connectedPlatforms = new Set(connectedAccounts.filter((a) => a.connected).map((a) => a.platform));
  const missingConnect = selectedPlatforms.filter((p) => !connectedPlatforms.has(p));

  const handlePublish = async () => {
    if (!selectedPlatforms.length) {
      toast({ title: 'Select at least one platform', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      const payloads =
        Object.keys(platformPayloads).length > 0
          ? platformPayloads
          : buildPlatformPayloads(item.content ?? '', item.title ?? '', selectedPlatforms);

      await contentItemsApi.update(item.id, {
        platforms: selectedPlatforms,
        platformPayloads: payloads,
        contentType: selectedPlatforms[0],
        status: 'approved',
      } as any);

      try {
        await invokeEdgeFunction('publish-content', {
          body: {
            contentId: item.id,
            platforms: selectedPlatforms,
            platformPayloads: payloads,
          },
        });
        toast({
          title: 'Published!',
          description: `Sent to ${selectedPlatforms.map((p) => platformOf(p).label).join(', ')}.`,
        });
      } catch {
        toast({
          title: 'Saved for publishing',
          description: 'Platform targets saved — connect publish API to go live.',
        });
      }
      onPublished();
    } catch (err: unknown) {
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display text-lg">Publish content</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {item.title || 'Untitled'} — pick platforms and preview before publishing.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
            Select platforms
          </Label>
          <MultiPlatformPicker values={selectedPlatforms} onChange={setSelectedPlatforms} />
        </div>

        <PlatformPreviewCarousel
          platforms={selectedPlatforms}
          platformPayloads={platformPayloads}
          title={item.title}
          baseContent={item.content}
          onEditPayload={updatePayload}
          editable
        />

        {missingConnect.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 dark:text-amber-200">
                Not connected for this workspace: {missingConnect.map((p) => platformOf(p).label).join(', ')}
              </p>
              <Link to="/publisher" className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
                <Link2 className="h-3 w-3" /> Connect accounts in Publisher Connect
              </Link>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 gradient-primary text-primary-foreground border-0"
            onClick={handlePublish}
            disabled={publishing || !selectedPlatforms.length}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Publish to {selectedPlatforms.length || 0} platform{selectedPlatforms.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
