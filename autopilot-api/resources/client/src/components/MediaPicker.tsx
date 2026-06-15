import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { mediaApi } from '@/lib/api';
import { normalizeMediaAsset, resolveMediaUrl, type MediaAsset } from '@/lib/mediaUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, Search, Check, X, Loader2 } from 'lucide-react';

interface Props {
  value?: string;
  onChange: (url: string | undefined) => void;
  accept?: string;
}

export function MediaPicker({ value, onChange, accept = 'image/*,video/*' }: Props) {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const loadAssets = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await mediaApi.findAll(tenant.id, activeWorkspace);
      setAssets(
        (Array.isArray(rows) ? rows : []).map((r) =>
          normalizeMediaAsset(r as Record<string, unknown>),
        ),
      );
    } catch {
      setAssets([]);
    }
    setLoading(false);
  }, [tenant, activeWorkspace]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, workspaceVersion]);

  const filtered = assets.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (a.name ?? '').toLowerCase().includes(q);
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenant || !activeWorkspace) return;
    setUploading(true);
    try {
      const asset = await mediaApi.upload(file, tenant.id, undefined, activeWorkspace);
      const normalized = normalizeMediaAsset(asset as Record<string, unknown>);
      setAssets((prev) => [normalized, ...prev]);
      onChange(normalized.mediaUrl);
      toast({ title: 'Upload complete' });
    } catch (err: unknown) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      {value && (
        <div className="relative inline-block">
          <img
            src={resolveMediaUrl(value)}
            alt="Selected"
            className="h-24 w-24 rounded-lg object-cover border"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Tabs defaultValue="library">
        <TabsList className="h-8">
          <TabsTrigger value="library" className="text-xs">Library</TabsTrigger>
          <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-2 mt-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search library…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onChange(asset.mediaUrl)}
                  className={`relative aspect-square rounded overflow-hidden border-2 transition-all
                    ${value === asset.mediaUrl ? 'border-primary' : 'border-transparent hover:border-muted-foreground'}`}
                >
                  {asset.mediaType === 'video' ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-[9px]">
                      Video
                    </div>
                  ) : (
                    <img
                      src={resolveMediaUrl(asset.mediaUrl)}
                      alt={asset.name ?? ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {value === asset.mediaUrl && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-5 py-8 text-center text-xs text-muted-foreground">
                  No assets in library yet.
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
          <Button
            variant="outline"
            className="w-full gap-2 h-20 border-dashed"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {uploading ? 'Uploading…' : 'Click to upload or drag & drop'}
            </span>
          </Button>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <div className="flex gap-2">
            <Input
              className="text-sm"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!urlInput.trim()}
              onClick={() => {
                onChange(urlInput.trim());
                setUrlInput('');
              }}
            >
              Use URL
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
