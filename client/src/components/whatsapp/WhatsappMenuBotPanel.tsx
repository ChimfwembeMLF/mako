import { useCallback, useEffect, useState } from 'react';
import { Bot, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { whatsappApi } from '@/lib/api';
import { useFieldEnhance } from '@/hooks/useFieldEnhance';
import { SuggestedField } from '@/components/form/SuggestedField';

type WaMenuItem = {
  id?: string;
  title: string;
  description?: string;
  response: string;
  aiGenerate?: boolean;
};

const emptyMenuItem = (): WaMenuItem => ({ title: '', description: '', response: '' });

type Props = {
  tenantId: string;
  workspaceId?: string | null;
  compact?: boolean;
};

export function WhatsappMenuBotPanel({ tenantId, workspaceId, compact }: Props) {
  const { toast } = useToast();
  const { enhanceField, enhancingKey } = useFieldEnhance('whatsapp-menu');

  const [enabled, setEnabled] = useState(false);
  const [serviceName, setServiceName] = useState('MyService');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [menuItems, setMenuItems] = useState<WaMenuItem[]>([emptyMenuItem()]);
  const [aiFallback, setAiFallback] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const ws = workspaceId ?? undefined;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const cfg = await whatsappApi.getFlowConfig(tenantId, ws);
      setEnabled(Boolean(cfg.enabled));
      setServiceName(cfg.serviceName || 'MyService');
      setWelcomeMessage(cfg.welcomeMessage || '');
      setAiFallback(cfg.aiFallbackEnabled !== false);
      const items = Array.isArray(cfg.menuItems) ? cfg.menuItems : [];
      setMenuItems(items.length ? items : [emptyMenuItem()]);
    } catch {
      setEnabled(false);
      setMenuItems([emptyMenuItem()]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, ws]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateMenuItem(index: number, patch: Partial<WaMenuItem>) {
    setMenuItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeMenuItem(index: number) {
    setMenuItems((prev) => (prev.length <= 1 ? [emptyMenuItem()] : prev.filter((_, i) => i !== index)));
  }

  async function save() {
    const normalized = menuItems
      .map((item) => ({
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        response: item.response.trim(),
        aiGenerate: Boolean(item.aiGenerate),
      }))
      .filter((item) => item.title && (item.response || item.aiGenerate));

    if (enabled && normalized.length === 0) {
      toast({
        title: 'Add at least one menu option',
        description: 'Each option needs a label and reply text or AI enabled.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await whatsappApi.updateFlowConfig(
        tenantId,
        {
          enabled,
          serviceName: serviceName.trim() || 'MyService',
          welcomeMessage: welcomeMessage.trim() || undefined,
          aiFallbackEnabled: aiFallback,
          menuItems: normalized,
        },
        ws,
      );
      toast({
        title: enabled ? 'Menu bot enabled' : 'Menu bot saved',
        description: enabled
          ? 'Customers can text Hi or menu to start.'
          : 'Configuration saved (bot is off until you enable it).',
      });
      void load();
    } catch (err: unknown) {
      toast({
        title: 'Could not save menu bot',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading menu bot…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Menu bot
        </CardTitle>
        <CardDescription>
          Customers text <strong>Hi</strong>, <strong>menu</strong>, or <strong>0</strong> to see your options.
          This is Mako&apos;s built-in menu — not Meta WhatsApp Flows forms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label htmlFor="wa-flow-enabled" className="text-sm font-medium">Enable menu bot</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Requires WhatsApp connected and at least one menu option.
            </p>
          </div>
          <Switch id="wa-flow-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label htmlFor="wa-flow-ai-fallback" className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI for free-text messages
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Reply to messages that don&apos;t match a menu option using Brand Brain context.
            </p>
          </div>
          <Switch id="wa-flow-ai-fallback" checked={aiFallback} onCheckedChange={setAiFallback} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Business / service name</Label>
          <SuggestedField
            type="input"
            value={serviceName}
            onChange={setServiceName}
            placeholder="e.g. Acme Shop"
            onEnhance={() => enhanceField('serviceName', serviceName, setServiceName)}
            enhancing={enhancingKey === 'serviceName'}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Custom welcome message (optional)</Label>
          <SuggestedField
            type="input"
            value={welcomeMessage}
            onChange={setWelcomeMessage}
            placeholder="Welcome to {serviceName}! How can we help?"
            onEnhance={() => enhanceField('welcomeMessage', welcomeMessage, setWelcomeMessage)}
            enhancing={enhancingKey === 'welcomeMessage'}
            className="h-9"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Menu options</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={menuItems.length >= 10}
              onClick={() => setMenuItems((prev) => [...prev, emptyMenuItem()])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add option
            </Button>
          </div>

          {menuItems.map((item, index) => (
            <div key={index} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Option {index + 1}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive"
                  onClick={() => removeMenuItem(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <SuggestedField
                type="input"
                value={item.title}
                onChange={(value) => updateMenuItem(index, { title: value })}
                placeholder="Menu label — e.g. Pricing, Support"
                onEnhance={() =>
                  enhanceField('menuTitle', item.title, (value) => updateMenuItem(index, { title: value }), `menuTitle-${index}`)
                }
                enhancing={enhancingKey === `menuTitle-${index}`}
                className="h-9"
              />
              <SuggestedField
                type="input"
                value={item.description ?? ''}
                onChange={(value) => updateMenuItem(index, { description: value })}
                placeholder="Short hint (optional)"
                onEnhance={() =>
                  enhanceField(
                    'menuDescription',
                    item.description ?? '',
                    (value) => updateMenuItem(index, { description: value }),
                    `menuDescription-${index}`,
                  )
                }
                enhancing={enhancingKey === `menuDescription-${index}`}
                className="h-9"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`wa-menu-ai-${index}`}
                  checked={Boolean(item.aiGenerate)}
                  onCheckedChange={(checked) => updateMenuItem(index, { aiGenerate: checked === true })}
                />
                <Label htmlFor={`wa-menu-ai-${index}`} className="text-xs font-normal cursor-pointer flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI writes the reply
                </Label>
              </div>
              <SuggestedField
                type="textarea"
                value={item.response}
                onChange={(value) => updateMenuItem(index, { response: value })}
                placeholder={
                  item.aiGenerate
                    ? 'Guidance for AI — e.g. share pricing and booking link'
                    : 'Reply when selected — sent to customer on WhatsApp'
                }
                onEnhance={() =>
                  enhanceField(
                    'menuResponse',
                    item.response,
                    (value) => updateMenuItem(index, { response: value }),
                    `menuResponse-${index}`,
                  )
                }
                enhancing={enhancingKey === `menuResponse-${index}`}
                rows={3}
              />
            </div>
          ))}
        </div>

        <Button size="sm" onClick={() => void save()} disabled={saving} className="w-full sm:w-auto">
          {saving ? 'Saving…' : 'Save menu bot'}
        </Button>
      </CardContent>
    </Card>
  );
}
