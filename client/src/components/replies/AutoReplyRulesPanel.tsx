import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { autoReplyRulesApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { Bot, Plus, Trash2, Save } from 'lucide-react';
import { autoReplyPlatforms } from '@/lib/platform-capabilities';

const SENTIMENTS = ['any', 'positive', 'negative', 'neutral'];

export interface ReplyRule {
  id: string;
  tenant_id: string;
  platform: string;
  name: string;
  trigger_keywords: string[];
  trigger_sentiment: string;
  response_template: string | null;
  ai_generate: boolean;
  is_active: boolean;
}

const BLANK_RULE: Omit<ReplyRule, 'id' | 'tenant_id'> = {
  platform: 'facebook',
  name: '',
  trigger_keywords: [],
  trigger_sentiment: 'any',
  response_template: '',
  ai_generate: true,
  is_active: true,
};

function fromRule(row: Record<string, unknown>): ReplyRule {
  return {
    id: String(row.id),
    tenant_id: String(row.tenantId),
    platform: String(row.platform),
    name: String(row.name),
    trigger_keywords: (row.triggerKeywords as string[]) ?? [],
    trigger_sentiment: String(row.triggerSentiment ?? 'any'),
    response_template: row.responseTemplate != null ? String(row.responseTemplate) : null,
    ai_generate: Boolean(row.aiGenerate),
    is_active: Boolean(row.isActive),
  };
}

function toRulePayload(editing: Partial<ReplyRule>, tenantId: string, workspaceId: string) {
  return {
    tenantId,
    workspaceId,
    platform: editing.platform,
    name: editing.name,
    triggerKeywords: editing.trigger_keywords,
    triggerSentiment: editing.trigger_sentiment,
    responseTemplate: editing.response_template,
    aiGenerate: editing.ai_generate,
    isActive: editing.is_active,
  };
}

function normalizePlatformFilter(filter?: string | string[] | null): string[] | null {
  if (!filter) return null;
  if (Array.isArray(filter)) return filter.length > 0 ? filter : null;
  return [filter];
}

/** Stable string key so inline array props do not retrigger effects every render. */
function platformListKey(value?: string | string[] | null): string {
  const list = normalizePlatformFilter(value);
  return list ? list.join(',') : '';
}

export interface AutoReplyRulesPanelProps {
  /** When set, only show/create rules for these platforms. */
  platformFilter?: string | string[] | null;
  /** Override platform options in the create/edit form. */
  platformOptions?: string[];
  description?: string;
  defaultPlatform?: string;
}

export function AutoReplyRulesPanel({
  platformFilter = null,
  platformOptions,
  description,
  defaultPlatform,
}: AutoReplyRulesPanelProps) {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();

  const tenantId = tenant?.id;
  const platformFilterKey = platformListKey(platformFilter);
  const platformOptionsKey = platformListKey(platformOptions);

  const filterPlatforms = useMemo(() => {
    if (!platformFilterKey) return null;
    return platformFilterKey.split(',');
  }, [platformFilterKey]);

  const availablePlatforms = useMemo(() => {
    const all = autoReplyPlatforms().map((p) => p.id);
    if (platformOptionsKey) return platformOptionsKey.split(',');
    if (filterPlatforms) return filterPlatforms;
    return all;
  }, [platformOptionsKey, filterPlatforms]);

  const blankRule = useMemo(
    () => ({
      ...BLANK_RULE,
      platform: defaultPlatform ?? availablePlatforms[0] ?? 'facebook',
    }),
    [availablePlatforms, defaultPlatform],
  );

  const [rules, setRules] = useState<ReplyRule[]>([]);
  const [editing, setEditing] = useState<Partial<ReplyRule> | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    if (!tenantId || !activeWorkspace) return;
    const platforms = platformFilterKey ? platformFilterKey.split(',') : null;
    try {
      const all = await autoReplyRulesApi.findAll(tenantId, activeWorkspace);
      const list = Array.isArray(all) ? all : [];
      let mapped = list.map(fromRule);
      if (platforms) {
        mapped = mapped.filter((r) => platforms.includes(r.platform));
      }
      setRules(mapped);
    } catch {
      setRules([]);
    }
  }, [tenantId, activeWorkspace, platformFilterKey]);

  useEffect(() => {
    if (!tenantId || !activeWorkspace) return;
    void loadRules();
  }, [tenantId, activeWorkspace, workspaceVersion, platformFilterKey, loadRules]);

  async function saveRule() {
    if (!editing?.name?.trim() || !tenant || !activeWorkspace) return;
    setSaving(true);
    try {
      const payload = toRulePayload(editing, tenant.id, activeWorkspace);
      if (editing.id) {
        await autoReplyRulesApi.update(editing.id, payload as any);
        setRules((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...editing } as ReplyRule : r)));
        toast({ title: 'Rule saved' });
      } else {
        const data = await autoReplyRulesApi.create(payload as any);
        setRules((prev) => [...prev, fromRule(data as Record<string, unknown>)]);
        toast({ title: 'Rule created' });
      }
      await logAudit({ tenantId: tenant.id, action: editing.id ? 'reply_rule.updated' : 'reply_rule.created' });
      setEditing(null);
      setKeyInput('');
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
    setSaving(false);
  }

  async function deleteRule(id: string) {
    if (!tenant) return;
    try {
      await autoReplyRulesApi.remove(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      await logAudit({ tenantId: tenant.id, action: 'reply_rule.deleted', resourceId: id });
      toast({ title: 'Rule deleted' });
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  }

  const addKeyword = () => {
    if (!keyInput.trim() || !editing) return;
    setEditing((e) => ({
      ...e!,
      trigger_keywords: [...(e!.trigger_keywords ?? []), keyInput.trim()],
    }));
    setKeyInput('');
  };

  const activeRules = rules.filter((r) => r.is_active).length;

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {activeRules > 0 && (
        <p className="text-xs text-muted-foreground">{activeRules} active rule{activeRules !== 1 ? 's' : ''}</p>
      )}

      <PermissionGate require={P.replies.manageRules}>
        <div className="rounded-lg border bg-card p-4 sm:p-5 space-y-4">
          <p className="font-medium text-sm">{editing?.id ? 'Edit rule' : 'New auto-reply rule'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Rule name</Label>
              <Input
                value={editing?.name ?? ''}
                onChange={(e) => setEditing((p) => ({ ...(p ?? blankRule), name: e.target.value }))}
                placeholder="e.g. Positive comment thanks"
              />
            </div>
            <div className="space-y-1">
              <Label>Platform</Label>
              <Select
                value={editing?.platform ?? blankRule.platform}
                onValueChange={(v) => setEditing((p) => ({ ...(p ?? blankRule), platform: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availablePlatforms.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sentiment trigger</Label>
              <Select
                value={editing?.trigger_sentiment ?? 'any'}
                onValueChange={(v) => setEditing((p) => ({ ...(p ?? blankRule), trigger_sentiment: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SENTIMENTS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Keywords (any match)</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Add keyword"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                />
                <Button size="sm" onClick={addKeyword} type="button" className="shrink-0 w-full sm:w-auto">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(editing?.trigger_keywords ?? []).map((kw) => (
                  <Badge
                    key={kw}
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() =>
                      setEditing((p) => ({
                        ...p!,
                        trigger_keywords: p!.trigger_keywords!.filter((k) => k !== kw),
                      }))
                    }
                  >
                    {kw} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label>Response template (when AI is off)</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">AI generate</span>
                <Switch
                  checked={editing?.ai_generate ?? true}
                  onCheckedChange={(v) => setEditing((p) => ({ ...(p ?? blankRule), ai_generate: v }))}
                />
              </div>
            </div>
            <Textarea
              rows={3}
              value={editing?.response_template ?? ''}
              placeholder="e.g. Thank you for your kind comment!"
              onChange={(e) =>
                setEditing((p) => ({ ...(p ?? blankRule), response_template: e.target.value }))
              }
              className="resize-none text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              size="sm"
              onClick={() => void saveRule()}
              disabled={saving || !editing?.name?.trim()}
              className="gap-1"
            >
              <Save className="h-3.5 w-3.5" />
              {editing?.id ? 'Save changes' : 'Create rule'}
            </Button>
            {editing && (
              <Button size="sm" variant="outline" onClick={() => { setEditing(null); setKeyInput(''); }}>
                Cancel
              </Button>
            )}
            {!editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...blankRule })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New rule
              </Button>
            )}
          </div>
        </div>
      </PermissionGate>

      <div className="space-y-2">
        {rules.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">No rules yet.</div>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{rule.name}</p>
                <Badge variant="outline" className="text-[10px] capitalize">{rule.platform}</Badge>
                {rule.ai_generate && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Bot className="h-3 w-3" /> AI
                  </Badge>
                )}
                {!rule.is_active && (
                  <Badge variant="secondary" className="text-[10px]">inactive</Badge>
                )}
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {rule.trigger_keywords.map((kw) => (
                  <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                ))}
                {rule.trigger_keywords.length === 0 && (
                  <Badge variant="outline" className="text-[10px]">catch-all</Badge>
                )}
                {rule.trigger_sentiment !== 'any' && (
                  <Badge variant="secondary" className="text-[10px]">{rule.trigger_sentiment}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Switch
                checked={rule.is_active}
                disabled={!can(P.replies.manageRules)}
                onCheckedChange={async (v) => {
                  await autoReplyRulesApi.update(rule.id, { isActive: v } as any);
                  void loadRules();
                }}
              />
              <PermissionGate require={P.replies.manageRules}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(rule);
                    setKeyInput('');
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteRule(rule.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </PermissionGate>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
