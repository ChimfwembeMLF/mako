import { useEffect, useMemo, useRef, useState } from 'react';
import { permissionsApi, systemSettingsApi, tenantsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { applyTheme, cacheGlobalTheme, type ThemeConfig } from '@/hooks/useTheme';
import { PermissionGate } from '@/components/PermissionGate';
import { ThemePalettePicker } from '@/components/admin/ThemePalettePicker';
import { confirmModal } from '@/components/ConfirmModal';
import { paletteSwatchHsl } from '@/lib/themePalettes';
import { P } from '@/lib/permissions';
import { MAKO_THEME } from '@/lib/mako-brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Palette, ShieldCheck, Target, Save, Loader2, Lock, Trash2, Plus, Search, ChevronDown,
  CheckCircle2, Undo2, Sun, Moon, Monitor,
} from 'lucide-react';

type SectionId = 'appearance' | 'permissions' | 'ads';

const SECTIONS: { id: SectionId; label: string; hint: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', hint: 'Colours and theme', icon: Palette },
  { id: 'permissions', label: 'Permissions', hint: 'What roles can grant', icon: ShieldCheck },
  { id: 'ads', label: 'Ad platforms', hint: 'Where campaigns can run', icon: Target },
];

const THEME_FIELDS: { key: keyof ThemeConfig; label: string; placeholder: string }[] = [
  { key: 'primary', label: 'Primary', placeholder: MAKO_THEME.primary },
  { key: 'secondary', label: 'Secondary', placeholder: MAKO_THEME.secondary },
  { key: 'accent', label: 'Accent', placeholder: MAKO_THEME.accent },
  { key: 'radius', label: 'Corner radius', placeholder: MAKO_THEME.radius },
];

const COLOR_MODES: { id: NonNullable<ThemeConfig['mode']>; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

const AD_PLATFORMS: { id: string; name: string; hint: string }[] = [
  { id: 'META', name: 'Meta', hint: 'Facebook and Instagram ads' },
  { id: 'GOOGLE', name: 'Google Ads', hint: 'Search, Display and YouTube' },
  { id: 'TIKTOK', name: 'TikTok', hint: 'In-feed video ads' },
  { id: 'LINKEDIN', name: 'LinkedIn', hint: 'Sponsored content for B2B' },
  { id: 'X', name: 'X', hint: 'Promoted posts' },
  { id: 'PINTEREST', name: 'Pinterest', hint: 'Promoted Pins' },
  { id: 'TABOOLA', name: 'Taboola', hint: 'Native ads on news sites' },
  { id: 'EMBED', name: 'Website embed', hint: 'Banners placed on your own site' },
];
const ALL_AD_IDS = AD_PLATFORMS.map((p) => p.id);

/** Every permission key the app's own code checks. These cannot be deleted from here. */
function builtInKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (node: unknown) => {
    if (typeof node === 'string') keys.add(node);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(P);
  return keys;
}
const BUILT_IN = builtInKeys();
const KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

type Permission = { key: string; label?: string; module?: string | null; description?: string | null };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

function SaveBar({ dirty, saving, onSave, onDiscard, label }: {
  dirty: boolean; saving: boolean; onSave: () => void; onDiscard?: () => void; label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-5 py-3 sm:px-6">
      <span className={cn('mr-auto flex items-center gap-1.5 text-xs', dirty ? 'text-warning-deep' : 'text-muted-foreground')}>
        {dirty ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </>
        )}
      </span>
      {onDiscard && dirty && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onDiscard} disabled={saving}>
          <Undo2 className="h-4 w-4" /> Discard
        </Button>
      )}
      <Button type="button" size="sm" className="gap-1.5 rounded-full px-4" onClick={onSave} disabled={!dirty || saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}

function Swatches({ theme }: { theme: ThemeConfig }) {
  const swatches = (['primary', 'secondary', 'accent'] as const)
    .map((k) => ({ k, hsl: theme[k] }))
    .filter((s): s is { k: 'primary' | 'secondary' | 'accent'; hsl: string } => Boolean(s.hsl?.trim()));
  if (!swatches.length) return <span className="text-xs text-muted-foreground">Uses the default palette</span>;
  return (
    <div className="flex items-center gap-1.5">
      {swatches.map(({ k, hsl }) => (
        <span
          key={k}
          title={k}
          className="h-5 w-5 rounded-full border border-black/10 shadow-sm"
          style={{ backgroundColor: paletteSwatchHsl(hsl) }}
        />
      ))}
    </div>
  );
}

function ThemeEditor({ value, onChange, onPreview, showMode }: {
  value: ThemeConfig;
  onChange: (t: ThemeConfig) => void;
  onPreview: (t: ThemeConfig) => void;
  showMode?: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const update = (next: ThemeConfig) => {
    onChange(next);
    onPreview(next);
  };
  return (
    <div className="space-y-5">
      <ThemePalettePicker value={value} onChange={onChange} onPreview={onPreview} />
      {showMode && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Default colour mode</p>
          <div className="grid max-w-md grid-cols-3 gap-2" role="radiogroup" aria-label="Default colour mode">
            {COLOR_MODES.map(({ id, label, icon: Icon }) => {
              const selected = (value.mode ?? 'light') === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update({ ...value, mode: id })}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted/50',
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">People can still switch for themselves from their account menu.</p>
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', advanced && 'rotate-180')} />
          Exact colour values (HSL)
        </button>
        {advanced && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {THEME_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`theme-${key}`} className="text-xs">{label}</Label>
                <Input
                  id={`theme-${key}`}
                  value={(value[key] as string | undefined) ?? ''}
                  placeholder={placeholder}
                  className="h-10 font-mono text-xs"
                  onChange={(e) => update({ ...value, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, description, aside, children, footer }: {
  title: string; description?: string; aside?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer}
    </section>
  );
}

export default function SystemSettingsPage() {
  const { tenant, refetch: refetchTenant } = useTenant();
  const { toast } = useToast();
  const [section, setSection] = useState<SectionId>('appearance');

  // Appearance
  const [globalTheme, setGlobalTheme] = useState<ThemeConfig>({});
  const [savedGlobal, setSavedGlobal] = useState<ThemeConfig>({});
  const [tenantTheme, setTenantTheme] = useState<ThemeConfig>({});
  const [savedTenant, setSavedTenant] = useState<ThemeConfig>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);

  // Permissions
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permQuery, setPermQuery] = useState('');
  const [newPerm, setNewPerm] = useState({ key: '', label: '', module: '' });
  const [adding, setAdding] = useState(false);

  // Ad platforms
  const [enabledAds, setEnabledAds] = useState<string[]>(ALL_AD_IDS);
  const [savedAds, setSavedAds] = useState<string[]>(ALL_AD_IDS);
  const [savingAds, setSavingAds] = useState(false);

  useEffect(() => {
    systemSettingsApi.getTheme().then((t) => {
      setGlobalTheme(t ?? {});
      setSavedGlobal(t ?? {});
    }).catch(() => {});
    permissionsApi.findAll().then((d) => setPermissions(Array.isArray(d) ? d : [])).catch(() => {});
    systemSettingsApi.findOne('enabled_ad_platforms').then((d) => {
      const list = d?.value?.platforms;
      if (Array.isArray(list)) {
        setEnabledAds(list);
        setSavedAds(list);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = (tenant?.themeConfig as ThemeConfig | undefined) ?? {};
    setTenantTheme(t);
    setSavedTenant(t);
  }, [tenant?.id, tenant?.themeConfig]);

  // Previews change the live theme; leaving the page puts the saved one back.
  const savedThemeRef = useRef<ThemeConfig>({});
  savedThemeRef.current = { ...savedGlobal, ...savedTenant };
  useEffect(() => () => applyTheme(savedThemeRef.current), []);

  const globalDirty = !same(globalTheme, savedGlobal);
  const tenantDirty = !same(tenantTheme, savedTenant);
  const adsDirty = !same([...enabledAds].sort(), [...savedAds].sort());

  const saveGlobalTheme = async () => {
    setSavingGlobal(true);
    try {
      await systemSettingsApi.upsert('theme', { value: globalTheme as Record<string, unknown>, description: 'Global UI theme' });
      setSavedGlobal(globalTheme);
      applyTheme({ ...globalTheme, ...tenantTheme });
      cacheGlobalTheme(globalTheme);
      toast({ title: 'Platform theme saved', description: 'Everyone sees it on their next page load.' });
    } catch (err) {
      toast({ title: "Couldn't save the theme", description: errorText(err), variant: 'destructive' });
    } finally {
      setSavingGlobal(false);
    }
  };

  const saveTenantTheme = async () => {
    if (!tenant) return;
    setSavingTenant(true);
    try {
      await tenantsApi.update(tenant.id, { themeConfig: tenantTheme });
      setSavedTenant(tenantTheme);
      applyTheme({ ...globalTheme, ...tenantTheme });
      refetchTenant();
      toast({ title: `${tenant.name}'s theme saved` });
    } catch (err) {
      toast({ title: "Couldn't save the theme", description: errorText(err), variant: 'destructive' });
    } finally {
      setSavingTenant(false);
    }
  };

  const saveEnabledAds = async () => {
    setSavingAds(true);
    try {
      await systemSettingsApi.upsert('enabled_ad_platforms', {
        value: { platforms: enabledAds },
        description: 'Globally enabled Ad Platforms',
      });
      setSavedAds(enabledAds);
      toast({ title: 'Ad platforms saved' });
    } catch (err) {
      toast({ title: "Couldn't save ad platforms", description: errorText(err), variant: 'destructive' });
    } finally {
      setSavingAds(false);
    }
  };

  const keyError = useMemo(() => {
    const key = newPerm.key.trim();
    if (!key) return null;
    if (!KEY_PATTERN.test(key)) return 'Use area.action in lowercase, like reports.export';
    if (permissions.some((p) => p.key === key)) return 'That key already exists';
    return null;
  }, [newPerm.key, permissions]);

  const addPermission = async () => {
    const key = newPerm.key.trim();
    const label = newPerm.label.trim();
    if (!key || !label || keyError) return;
    setAdding(true);
    try {
      const module = newPerm.module.trim() || key.split('.')[0];
      const created = await permissionsApi.create({ key, label, module });
      setPermissions((prev) => [...prev, (created as Permission) ?? { key, label, module }]);
      setNewPerm({ key: '', label: '', module: '' });
      toast({ title: 'Permission added', description: 'You can now grant it in Roles & permissions.' });
    } catch (err) {
      toast({ title: "Couldn't add the permission", description: errorText(err), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const deletePermission = async (p: Permission) => {
    const ok = await confirmModal(
      'Roles that grant it will lose it straight away, and anything that checks for it will stop allowing access.',
      `Delete “${p.label || p.key}”?`,
      'Delete',
    );
    if (!ok) return;
    try {
      await permissionsApi.remove(p.key);
      setPermissions((prev) => prev.filter((x) => x.key !== p.key));
      toast({ title: 'Permission deleted' });
    } catch (err) {
      toast({ title: "Couldn't delete it", description: errorText(err), variant: 'destructive' });
    }
  };

  const groups = useMemo(() => {
    const q = permQuery.trim().toLowerCase();
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (q && !`${p.key} ${p.label ?? ''} ${p.module ?? ''}`.toLowerCase().includes(q)) continue;
      const area = (p.module || p.key.split('.')[0] || 'other').toLowerCase();
      map.set(area, [...(map.get(area) ?? []), p]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([area, list]) => [area, list.sort((x, y) => x.key.localeCompare(y.key))] as const);
  }, [permissions, permQuery]);
  const customCount = permissions.filter((p) => !BUILT_IN.has(p.key)).length;

  const dirtyBySection: Record<SectionId, boolean> = {
    appearance: globalDirty || tenantDirty,
    permissions: false,
    ads: adsDirty,
  };

  return (
    <PermissionGate superAdmin fallback={true}>
      <div className="w-full min-w-0 space-y-6 pb-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">System settings</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Super admins
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Settings for the whole Mako platform. Changes here affect every organisation.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="System settings sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
              {SECTIONS.map((s) => {
                const current = section === s.id;
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSection(s.id)}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors lg:py-2.5',
                        current
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground lg:border-transparent lg:bg-transparent lg:hover:bg-muted/60',
                      )}
                    >
                      <s.icon className={cn('h-4 w-4 shrink-0', current && 'text-primary')} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block whitespace-nowrap text-sm', current && 'font-medium')}>{s.label}</span>
                        <span className="hidden text-xs text-muted-foreground lg:block">{s.hint}</span>
                      </span>
                      {dirtyBySection[s.id] && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-label="Unsaved changes" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 space-y-6">
            {section === 'appearance' && (
              <>
                <Card
                  title="Platform theme"
                  description="The colours everyone sees unless their organisation has its own."
                  aside={<Swatches theme={globalTheme} />}
                  footer={
                    <SaveBar
                      dirty={globalDirty}
                      saving={savingGlobal}
                      onSave={() => void saveGlobalTheme()}
                      onDiscard={() => {
                        setGlobalTheme(savedGlobal);
                        applyTheme({ ...savedGlobal, ...tenantTheme });
                      }}
                      label="Save platform theme"
                    />
                  }
                >
                  <ThemeEditor
                    value={globalTheme}
                    onChange={setGlobalTheme}
                    onPreview={(t) => applyTheme({ ...t, ...tenantTheme })}
                    showMode
                  />
                </Card>

                {tenant && (
                  <Card
                    title={`${tenant.name} only`}
                    description="Optional colours for this organisation, on top of the platform theme. Leave it empty to use the platform theme."
                    aside={<Swatches theme={tenantTheme} />}
                    footer={
                      <SaveBar
                        dirty={tenantDirty}
                        saving={savingTenant}
                        onSave={() => void saveTenantTheme()}
                        onDiscard={() => {
                          setTenantTheme(savedTenant);
                          applyTheme({ ...globalTheme, ...savedTenant });
                        }}
                        label="Save for this organisation"
                      />
                    }
                  >
                    <ThemeEditor value={tenantTheme} onChange={setTenantTheme} onPreview={(t) => applyTheme({ ...globalTheme, ...t })} />
                  </Card>
                )}
              </>
            )}

            {section === 'permissions' && (
              <>
                <Card
                  title="Permission catalogue"
                  description={`${permissions.length} permissions roles can grant. ${customCount} added here; the rest are built in.`}
                >
                  <div className="relative mb-4 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={permQuery}
                      onChange={(e) => setPermQuery(e.target.value)}
                      placeholder="Search permissions"
                      aria-label="Search permissions"
                      className="h-10 rounded-full pl-9"
                    />
                  </div>
                  {groups.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No permissions match “{permQuery}”.</p>
                  ) : (
                    <div className="space-y-5">
                      {groups.map(([area, list]) => (
                        <div key={area}>
                          <p className="mb-1.5 text-xs font-medium capitalize text-muted-foreground">
                            {area.replace(/_/g, ' ')} <span className="tabular-nums">· {list.length}</span>
                          </p>
                          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
                            {list.map((p) => {
                              const builtIn = BUILT_IN.has(p.key);
                              return (
                                <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm">{p.label || p.key}</p>
                                    <p className="truncate font-mono text-[11px] text-muted-foreground">{p.key}</p>
                                  </div>
                                  {builtIn ? (
                                    <span
                                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                                      title="Mako's code checks this permission, so it can't be deleted."
                                    >
                                      <Lock className="h-3 w-3" /> Built in
                                    </span>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 shrink-0 rounded-full text-destructive hover:text-destructive"
                                      onClick={() => void deletePermission(p)}
                                      aria-label={`Delete ${p.label || p.key}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card title="Add a permission" description="For new features that check a permission of their own. Grant it to roles in Roles & permissions.">
                  <form
                    className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addPermission();
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="perm-key">Key</Label>
                      <Input
                        id="perm-key"
                        value={newPerm.key}
                        onChange={(e) => setNewPerm((p) => ({ ...p, key: e.target.value.toLowerCase() }))}
                        placeholder="reports.export"
                        className="h-10 font-mono text-sm"
                        aria-invalid={Boolean(keyError)}
                      />
                      <p className={cn('text-xs', keyError ? 'text-destructive' : 'text-muted-foreground')}>
                        {keyError ?? 'area.action, lowercase'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="perm-label">Name people see</Label>
                      <Input
                        id="perm-label"
                        value={newPerm.label}
                        onChange={(e) => setNewPerm((p) => ({ ...p, label: e.target.value }))}
                        placeholder="Export reports"
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Grouped under “{(newPerm.key.split('.')[0] || 'area').replace(/_/g, ' ')}”
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="h-10 gap-1.5 rounded-full sm:mt-[22px]"
                      disabled={adding || !newPerm.key.trim() || !newPerm.label.trim() || Boolean(keyError)}
                    >
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add
                    </Button>
                  </form>
                </Card>
              </>
            )}

            {section === 'ads' && (
              <Card
                title="Ad platforms"
                description="Which platforms people can plan and generate ad campaigns for. Turning one off hides it everywhere."
                aside={
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {enabledAds.length} of {AD_PLATFORMS.length} on
                  </span>
                }
                footer={
                  <SaveBar
                    dirty={adsDirty}
                    saving={savingAds}
                    onSave={() => void saveEnabledAds()}
                    onDiscard={() => setEnabledAds(savedAds)}
                    label="Save ad platforms"
                  />
                }
              >
                <ul className="grid gap-3 sm:grid-cols-2">
                  {AD_PLATFORMS.map((p) => {
                    const on = enabledAds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label
                          htmlFor={`ad-${p.id}`}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                            on ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">{p.hint}</span>
                          </span>
                          <Switch
                            id={`ad-${p.id}`}
                            checked={on}
                            onCheckedChange={(v) =>
                              setEnabledAds((prev) => (v ? [...new Set([...prev, p.id])] : prev.filter((x) => x !== p.id)))
                            }
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
