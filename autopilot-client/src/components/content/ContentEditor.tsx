import { useEffect, useState } from 'react';
import { Sparkles, Loader2, ImagePlus, Images, X, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { contentItemsApi } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import RichTextEditor from '@/components/RichTextEditor';
import { MediaUpload } from '@/components/MediaUpload';
import ImageEditor from '@/components/ImageEditor';
import { ContentItem } from './types';

interface ContentEditorProps {
  item?: ContentItem | null;
  workspaceId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}

export function ContentEditor({ item, workspaceId, onCancel, onSaved }: ContentEditorProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [theme, setTheme] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingSlideshow, setGeneratingSlideshow] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: string }[]>([]);
  const [pendingSlides, setPendingSlides] = useState<string[]>([]);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setTheme(item?.campaign_theme ?? '');
    setTitle(item?.title ?? '');
    setContent(item?.content ?? '');
    if (!item) {
      setPendingMedia([]);
      setPendingSlides([]);
    }
  }, [item]);

  const handleGenerate = async () => {
    if (!user || !workspaceId) {
      toast({ title: 'Select a workspace first', variant: 'destructive' });
      return;
    }
    if (!theme.trim() && !content.trim()) {
      toast({ title: 'Add a theme or some draft content', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await invokeEdgeFunction('generate-content', {
        body: { theme, workspace_id: workspaceId },
      });
      if (!error && data) {
        const result = data as { error?: string; content?: string; title?: string };
        if (!result.error) {
          if (result.content) setContent(result.content);
          if (result.title) setTitle(result.title);
          toast({ title: 'Content generated' });
          return;
        }
      }
      if (theme.trim() && !content.trim()) {
        setContent(`<p>${theme}</p>`);
        if (!title.trim()) setTitle(theme.slice(0, 80));
      }
      toast({ title: 'Draft ready', description: 'Review and save your content.' });
    } catch (err: unknown) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!user || !workspaceId) {
      toast({ title: 'Select a workspace first', variant: 'destructive' });
      return;
    }
    if (!content.trim() && !title.trim()) {
      toast({ title: 'Add a title or content', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        userId: user.id,
        tenantId: tenant?.id,
        workspaceId,
        brandProfileId: tenant?.id,
        contentType: 'content',
        content,
        title: title || 'Untitled',
        campaignTheme: theme || undefined,
        status: 'draft',
      };
      if (item?.id) {
        await contentItemsApi.update(item.id, body as any);
        toast({ title: 'Content updated' });
      } else {
        await contentItemsApi.create(body as any);
        toast({ title: 'Content saved', description: 'Ready to publish when you are.' });
      }
      onSaved();
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const { data, error } = await invokeEdgeFunction('generate-image', {
        body: { prompt: imagePrompt, contentType: 'content' },
      });
      if (error) throw error;
      const result = data as { error?: string; media_url?: string; media_type?: string } | null;
      if (result?.error) throw new Error(result.error);
      if (result?.media_url) {
        setPendingMedia((prev) => [...prev, { url: result.media_url!, type: result.media_type || 'image' }]);
      }
      toast({ title: 'Image attached' });
    } catch (err: unknown) {
      toast({
        title: 'Image generation failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateSlideshow = async () => {
    setGeneratingSlideshow(true);
    try {
      const { data, error } = await invokeEdgeFunction('generate-slideshow', {
        body: { theme: theme || imagePrompt || 'brand showcase', contentType: 'content', slideCount: 4 },
      });
      if (error) throw error;
      const result = data as { error?: string; slides?: string[] } | null;
      if (result?.error) throw new Error(result.error);
      setPendingSlides(result?.slides ?? []);
      toast({ title: 'Slideshow ready' });
    } catch (err: unknown) {
      toast({
        title: 'Slideshow failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setGeneratingSlideshow(false);
    }
  };

  return (
    <>
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg">
            {item?.id ? 'Edit content' : 'Create content'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Write your content here — choose platforms when you publish.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign theme</Label>
            <Textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. Summer sale, product launch…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post headline" />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your content…"
              minHeight="160px"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>Media (optional)</Label>
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="AI image prompt…"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleGenerateImage} disabled={generatingImage}>
                {generatingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={handleGenerateSlideshow} disabled={generatingSlideshow}>
                {generatingSlideshow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
              </Button>
            </div>
            <MediaUpload
              onUpload={(url, type) => {
                setPendingMedia((prev) => [...prev, { url, type }]);
                setPendingSlides([]);
              }}
            />
            {pendingMedia.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingMedia.map((m, i) => (
                  <div key={i} className="relative">
                    <img src={m.url} alt="" className="w-14 h-14 object-cover rounded-md border" />
                    <button
                      type="button"
                      onClick={() => setEditingImageUrl(m.url)}
                      className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-md bg-black/70 flex items-center justify-center"
                    >
                      <Pencil className="h-2.5 w-2.5 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingMedia((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate with AI
          </Button>

          <div className="flex gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 gradient-primary text-primary-foreground border-0"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save content
            </Button>
          </div>
        </CardContent>
      </Card>

      {editingImageUrl && (
        <ImageEditor
          imageUrl={editingImageUrl}
          open={!!editingImageUrl}
          onClose={() => setEditingImageUrl(null)}
          onSave={(url) => {
            setPendingMedia((prev) => [...prev, { url, type: 'image' }]);
            setEditingImageUrl(null);
          }}
        />
      )}
    </>
  );
}
