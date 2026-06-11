import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, ImagePlus, Images, X, Pencil, Save, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useFormSuggestions } from '@/hooks/useFormSuggestions';
import { SuggestedField } from '@/components/form/SuggestedField';
import { contentItemsApi, templatesApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { MediaUpload } from '@/components/MediaUpload';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import ImageEditor from '@/components/ImageEditor';
import { ContentItem } from './types';

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

interface ContentEditorProps {
  item?: ContentItem | null;
  workspaceId: string | null;
  onReset?: () => void;
  onSaved: () => void;
}

export function ContentEditor({ item, workspaceId, onReset, onSaved }: ContentEditorProps) {
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
  const [pendingMedia, setPendingMedia] = useState<
    { url: string; type: string; assetId?: string }[]
  >([]);
  const [pendingSlides, setPendingSlides] = useState<string[]>([]);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const [templateId, setTemplateId] = useState<string>('');

  const contentFieldKeys = useMemo(() => ['theme', 'title'], []);
  const contentValues = useMemo(() => ({ theme, title }), [theme, title]);
  const { getPlaceholder, getSuggestionsForField, getSelectedIndex, setFieldIndex, pauseField, isFieldActive } = useFormSuggestions({
    form: 'content',
    tenantId: tenant?.id,
    fieldKeys: contentFieldKeys,
    values: contentValues,
  });

  useEffect(() => {
    setTheme(stripHtml(item?.campaign_theme ?? ''));
    setTitle(item?.title ?? '');
    setContent(stripHtml(item?.content ?? ''));
    if (!item) {
      setPendingMedia([]);
      setPendingSlides([]);
      setImagePrompt('');
    }
  }, [item]);

  useEffect(() => {
    if (!tenant?.id) {
      setTemplates([]);
      return;
    }
    templatesApi
      .findAll(tenant.id)
      .then((rows) => {
        const active = (Array.isArray(rows) ? rows : []).filter((t) => t.isActive !== false);
        setTemplates(active.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive })));
      })
      .catch(() => setTemplates([]));
  }, [tenant?.id]);

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
        body: {
          theme,
          draft: content.trim() || undefined,
          workspace_id: workspaceId,
          tenantId: tenant?.id,
          templateId: templateId || undefined,
        },
      });
      if (!error && data) {
        const result = data as { error?: string; content?: string; title?: string };
        if (!result.error) {
          if (result.content) setContent(stripHtml(result.content));
          if (result.title) setTitle(result.title);
          toast({ title: 'Content generated' });
          return;
        }
      }
      if (theme.trim() && !content.trim()) {
        setContent(theme.trim());
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
        tenantId: tenant?.id,
        workspaceId,
        contentType: 'content',
        content,
        title: title || 'Untitled',
        campaignTheme: theme || undefined,
        status: 'draft',
      };
      let contentId = item?.id;
      if (contentId) {
        await contentItemsApi.update(contentId, body as any);
        toast({ title: 'Content updated' });
      } else {
        const created = await contentItemsApi.create(body as any);
        contentId = created?.id;
        toast({ title: 'Content saved', description: 'Ready to publish when you are.' });
      }
      const mediaItems = [
        ...pendingMedia.map((m) => ({
          url: m.url,
          type: m.type,
          assetId: m.assetId,
        })),
        ...pendingSlides.map((url) => ({ url, type: 'image' as const })),
      ];
      if (contentId && tenant?.id && mediaItems.length) {
        await contentItemsApi.attachMedia(contentId, tenant.id, mediaItems);
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
        body: { prompt: imagePrompt, contentType: 'content', tenantId: tenant?.id },
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
        body: { theme: theme || imagePrompt || 'brand showcase', contentType: 'content', slideCount: 4, tenantId: tenant?.id },
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
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-muted/30">
          <div>
            <h2 className="font-display text-base font-semibold">
              {item?.id ? 'Edit draft' : 'Compose'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Write or generate content — publish to platforms when ready.
            </p>
          </div>
          {item?.id && onReset && (
            <Button type="button" variant="outline" size="sm" onClick={onReset} className="shrink-0">
              <FilePlus className="h-3.5 w-3.5 mr-1.5" />
              New draft
            </Button>
          )}
        </div>

        <div className="p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.length > 0 && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Content template</Label>
                <Select value={templateId || 'auto'} onValueChange={(v) => setTemplateId(v === 'auto' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto (match platform / type)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto — pick best active template</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="content-theme">Campaign theme</Label>
              <SuggestedField
                id="content-theme"
                type="input"
                value={theme}
                onChange={setTheme}
                fallbackPlaceholder="e.g. Summer sale, product launch, weekly tip…"
                placeholder={getPlaceholder('theme', 'e.g. Summer sale, product launch, weekly tip…')}
                suggestions={getSuggestionsForField('theme')}
                selectedIndex={getSelectedIndex('theme')}
                onSelectIndex={(index) => setFieldIndex('theme', index)}
                onPauseRotation={() => pauseField('theme')}
                isLive={isFieldActive('theme')}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="content-title">Title</Label>
              <SuggestedField
                id="content-title"
                type="input"
                value={title}
                onChange={setTitle}
                fallbackPlaceholder="Post headline"
                placeholder={getPlaceholder('title', 'Post headline')}
                suggestions={getSuggestionsForField('title')}
                selectedIndex={getSelectedIndex('title')}
                onSelectIndex={(index) => setFieldIndex('title', index)}
                onPauseRotation={() => pauseField('title')}
                isLive={isFieldActive('title')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-body">Content</Label>
            <Textarea
              id="content-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content…"
              rows={8}
              className="resize-y min-h-[180px]"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Media</Label>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="AI image prompt…"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="flex-1"
              />
              <div className="flex gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={handleGenerateImage} disabled={generatingImage}>
                  {generatingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Image</span>
                </Button>
                <Button type="button" variant="outline" onClick={handleGenerateSlideshow} disabled={generatingSlideshow}>
                  {generatingSlideshow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Slides</span>
                </Button>
              </div>
            </div>
            <MediaUpload
              contentId={item?.id}
              onUpload={(url, type, existingId) => {
                setPendingMedia((prev) => {
                  if (prev.some((m) => m.url === url)) return prev;
                  return [...prev, { url, type, assetId: existingId }];
                });
                setPendingSlides([]);
              }}
            />
            {pendingMedia.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {pendingMedia.map((m, i) => (
                  <div key={i} className="relative group">
                    <img src={resolveMediaUrl(m.url)} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => setEditingImageUrl(m.url)}
                      className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3 w-3 text-white" />
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
            variant="secondary"
            className="w-full"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate with AI
          </Button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-muted/20">
          <Button
            type="button"
            className="gradient-primary text-primary-foreground border-0 min-w-[140px]"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {item?.id ? 'Update' : 'Save draft'}
          </Button>
        </div>
      </div>

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
