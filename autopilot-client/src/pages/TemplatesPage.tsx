import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { LayoutTemplate, Plus, Pencil, Trash2, Copy, CheckCircle2 } from 'lucide-react';

interface Template {
  id: string; tenant_id: string | null; platform: string; name: string;
  description: string | null; is_active: boolean; is_system: boolean;
  prompt_instructions: string; created_at: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  facebook:'🟦', linkedin:'💼', instagram:'📸', twitter:'🐦',
  whatsapp:'💬', email:'📧', ad_copy:'📣',
};
const PLATFORM_LABELS: Record<string, string> = {
  facebook:'Facebook', linkedin:'LinkedIn', instagram:'Instagram', twitter:'X / Twitter',
  whatsapp:'WhatsApp', email:'Email', ad_copy:'Ad Copy',
};
const PLATFORMS = Object.keys(PLATFORM_LABELS);

export default function TemplatesPage() {
  const navigate          = useNavigate();
  const { tenant }        = useTenant();
  const { can }           = usePermissions();
  const { toast }         = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterPlatform, setFilter] = useState<string>('all');

  useEffect(() => { if (tenant) load(); }, [tenant]);

  async function load() {
    setLoading(true);
    setTemplates([]);
    setLoading(false);
  }

  function showComingSoon() {
    toast({
      title: 'Coming soon',
      description: 'Content templates are not available yet.',
    });
  }

  async function toggleActive(tmpl: Template) {
    if (!can(P.templates.activate) || tmpl.is_system) return;
    showComingSoon();
  }

  async function cloneTemplate(_tmpl: Template) {
    if (!tenant) return;
    showComingSoon();
  }

  async function deleteTemplate(tmpl: Template) {
    if (tmpl.is_system) return;
    showComingSoon();
  }

  const filtered = templates.filter(t => filterPlatform === 'all' || t.platform === filterPlatform);
  const byPlatform = PLATFORMS.reduce<Record<string, Template[]>>((acc, p) => {
    acc[p] = filtered.filter(t => t.platform === p); return acc;
  }, {});

  return (
    <PermissionGate require={P.templates.view} fallback={true}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Content Templates</h1>
              <p className="text-sm text-muted-foreground">Platform-specific templates that govern how AI generates content.</p>
            </div>
          </div>
          <PermissionGate require={P.templates.create}>
            <Button asChild className="gap-1"><Link to="/templates/new"><Plus className="h-4 w-4"/>New Template</Link></Button>
          </PermissionGate>
        </div>

        {/* Platform filter */}
        <div className="flex flex-wrap gap-2">
          <Button variant={filterPlatform==='all'?'default':'outline'} size="sm" onClick={()=>setFilter('all')}>All</Button>
          {PLATFORMS.map(p=>(
            <Button key={p} variant={filterPlatform===p?'default':'outline'} size="sm"
              onClick={()=>setFilter(p)} className="gap-1">
              {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}
            </Button>
          ))}
        </div>

        {loading ? <div className="py-12 text-center text-muted-foreground text-sm">Loading templates…</div> : (
          <div className="space-y-6">
            {PLATFORMS.filter(p => byPlatform[p]?.length > 0).map(platform => (
              <div key={platform} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PLATFORM_ICONS[platform]}</span>
                  <h2 className="font-semibold text-sm">{PLATFORM_LABELS[platform]}</h2>
                  <Separator className="flex-1" />
                </div>
                <div className="grid gap-3">
                  {byPlatform[platform].map(tmpl => (
                    <div key={tmpl.id}
                      className={`rounded-lg border bg-card p-4 flex items-start justify-between gap-4
                        ${tmpl.is_active ? 'ring-2 ring-primary/30' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{tmpl.name}</p>
                          {tmpl.is_system && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                          {tmpl.is_active && (
                            <Badge className="gap-1 text-[10px] bg-green-600">
                              <CheckCircle2 className="h-3 w-3"/> Active
                            </Badge>
                          )}
                        </div>
                        {tmpl.description && <p className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 font-mono">
                          {tmpl.prompt_instructions.slice(0, 120)}…
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!tmpl.is_system && can(P.templates.activate) && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Active</span>
                            <Switch checked={tmpl.is_active} onCheckedChange={()=>toggleActive(tmpl)} />
                          </div>
                        )}
                        <Button variant="ghost" size="sm" onClick={()=>cloneTemplate(tmpl)} title="Clone">
                          <Copy className="h-3.5 w-3.5"/>
                        </Button>
                        {!tmpl.is_system && can(P.templates.edit) && (
                          <Button variant="ghost" size="sm" asChild title="Edit">
                            <Link to={`/templates/${tmpl.id}`}><Pencil className="h-3.5 w-3.5"/></Link>
                          </Button>
                        )}
                        {!tmpl.is_system && can(P.templates.delete) && (
                          <Button variant="ghost" size="sm" onClick={()=>deleteTemplate(tmpl)}
                            className="text-destructive hover:text-destructive" title="Delete">
                            <Trash2 className="h-3.5 w-3.5"/>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
