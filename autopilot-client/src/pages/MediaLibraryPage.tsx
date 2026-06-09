import React, { useEffect, useRef, useState } from 'react';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { Image, Upload, Search } from 'lucide-react';

interface Asset {
  id: string; tenant_id: string; content_id: string | null;
  media_url: string; media_type: string; name: string | null;
  tags: string[]; file_size_bytes: number | null; width_px: number | null; height_px: number | null;
  alt_text: string | null; created_at: string | null; uploaded_by: string | null;
}

export default function MediaLibraryPage() {
  const { tenant }       = useTenant();
  const { toast }        = useToast();
  const fileRef          = useRef<HTMLInputElement>(null);
  const [assets, setAssets]     = useState<Asset[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    setAssets([]);
    setLoading(false);
  }, [tenant, search]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setUploading(true);
    toast({
      title: 'Coming soon',
      description: 'Media library uploads are not available yet.',
    });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteAsset(_asset: Asset) {
    toast({
      title: 'Coming soon',
      description: 'Media deletion is not available yet.',
    });
  }

  return (
    <PermissionGate require={P.media.view} fallback={true}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Media Library</h1>
              <p className="text-sm text-muted-foreground">All brand assets for {tenant?.name}.</p>
            </div>
          </div>
          <PermissionGate require={P.media.upload}>
            <div>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload Asset'}
              </Button>
            </div>
          </PermissionGate>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Image className="h-14 w-14 opacity-20 mb-4" />
            <p className="text-sm">{search ? 'No assets match your search.' : 'No assets yet. Upload one to get started.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {assets.map(asset => (
              <div key={asset.id} className="group relative rounded-lg border bg-card overflow-hidden">
                <div className="aspect-square bg-muted">
                  {asset.media_type === 'video' ? (
                    <video src={asset.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={asset.media_url} alt={asset.alt_text ?? asset.name ?? ''}
                      className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
