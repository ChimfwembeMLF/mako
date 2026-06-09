import React, { useEffect, useRef, useState } from 'react';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, Search, Check, X } from 'lucide-react';

interface Asset { id: string; media_url: string; name: string | null; media_type: string }

interface Props {
  value?: string;
  onChange: (url: string | undefined) => void;
  accept?: string;
}

export function MediaPicker({ value, onChange, accept = 'image/*' }: Props) {
  const { tenant }  = useTenant();
  const { toast }   = useToast();
  const fileRef     = useRef<HTMLInputElement>(null);
  const [assets]    = useState<Asset[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
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

  return (
    <div className="space-y-3">
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="Selected" className="h-24 w-24 rounded-lg object-cover border" />
          <button onClick={() => onChange(undefined)}
            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Tabs defaultValue="library">
        <TabsList className="h-8">
          <TabsTrigger value="library"  className="text-xs">Library</TabsTrigger>
          <TabsTrigger value="upload"   className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="url"      className="text-xs">URL</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-2 mt-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Search library…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({length:10}).map((_,i)=>
                <div key={i} className="aspect-square rounded bg-muted animate-pulse"/>)}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
              {assets.map(asset => (
                <button key={asset.id} onClick={() => onChange(asset.media_url)}
                  className={`relative aspect-square rounded overflow-hidden border-2 transition-all
                    ${value === asset.media_url ? 'border-primary' : 'border-transparent hover:border-muted-foreground'}`}>
                  <img src={asset.media_url} alt={asset.name ?? ''} className="w-full h-full object-cover" loading="lazy" />
                  {value === asset.media_url && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
              {assets.length === 0 && (
                <div className="col-span-5 py-8 text-center text-xs text-muted-foreground">
                  No assets in library yet.
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
          <Button variant="outline" className="w-full gap-2 h-20 border-dashed"
            onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploading ? 'Uploading…' : 'Click to upload an image or drag & drop'}
            </span>
          </Button>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <div className="flex gap-2">
            <Input className="text-sm" placeholder="https://example.com/image.jpg"
              value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            <Button size="sm" disabled={!urlInput.trim()}
              onClick={() => { onChange(urlInput.trim()); setUrlInput(''); }}>
              Use URL
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
