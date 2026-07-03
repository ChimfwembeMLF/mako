import React, { useEffect, useState } from 'react';
import { permissionsApi, systemSettingsApi, tenantsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { applyTheme, ThemeConfig } from '@/hooks/useTheme';
import { PermissionGate } from '@/components/PermissionGate';
import { ThemePalettePicker } from '@/components/admin/ThemePalettePicker';
import { paletteSwatchHsl } from '@/lib/themePalettes';
import { Field, FormSection, FormRow, FormInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Palette, ShieldCheck, Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';

import { MAKO_THEME } from '@/lib/mako-brand';

const THEME_FIELDS: { key: keyof ThemeConfig; label: string; placeholder: string }[] = [
  { key: 'primary', label: 'Primary', placeholder: MAKO_THEME.primary },
  { key: 'secondary', label: 'Secondary', placeholder: MAKO_THEME.secondary },
  { key: 'accent', label: 'Accent', placeholder: MAKO_THEME.accent },
  { key: 'radius', label: 'Border radius', placeholder: MAKO_THEME.radius },
];

export default function SystemSettingsPage() {
  const { tenant, refetch: refetchTenant } = useTenant();
  const { isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  const [globalTheme, setGlobalTheme] = useState<ThemeConfig>({});
  const [tenantTheme, setTenantTheme] = useState<ThemeConfig>({});
  const [savingTheme, setSavingTheme] = useState(false);

  const [permissions, setPermissions] = useState<any[]>([]);
  const [newPerm, setNewPerm] = useState({ key: '', label: '', module: '' });
  const [showGlobalAdvanced, setShowGlobalAdvanced] = useState(false);
  const [showTenantAdvanced, setShowTenantAdvanced] = useState(false);

  function ThemePreviewStrip({ theme }: { theme: ThemeConfig }) {
    const swatches = [
      { label: 'Primary', hsl: theme.primary },
      { label: 'Secondary', hsl: theme.secondary },
      { label: 'Accent', hsl: theme.accent },
    ].filter((s): s is { label: string; hsl: string } => Boolean(s.hsl?.trim()));

    if (swatches.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
        {swatches.map(({ label, hsl }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <div
              className="h-7 w-7 rounded-md border border-black/10 shadow-sm"
              style={{ backgroundColor: paletteSwatchHsl(hsl) }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
        {theme.radius && (
          <span className="text-xs text-muted-foreground self-center ml-auto">Radius {theme.radius}</span>
        )}
      </div>
    );
  }

  useEffect(() => {
    systemSettingsApi.getTheme().then(setGlobalTheme).catch(() => {});
    permissionsApi.findAll().then((d) => setPermissions(Array.isArray(d) ? d : [])).catch(() => {});
    if (tenant?.themeConfig) setTenantTheme(tenant.themeConfig as ThemeConfig);
  }, [tenant]);

  async function saveGlobalTheme() {
    setSavingTheme(true);
    try {
      await systemSettingsApi.upsert('theme', {
        value: globalTheme as Record<string, unknown>,
        description: 'Global UI theme',
      });
      applyTheme(globalTheme);
      toast({ title: 'Global theme saved' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSavingTheme(false);
    }
  }

  async function saveTenantTheme() {
    if (!tenant) return;
    setSavingTheme(true);
    try {
      await tenantsApi.update(tenant.id, { themeConfig: tenantTheme });
      applyTheme({ ...globalTheme, ...tenantTheme });
      refetchTenant();
      toast({ title: 'Workspace theme saved' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSavingTheme(false);
    }
  }

  async function addPermission() {
    if (!newPerm.key.trim() || !newPerm.label.trim()) return;
    try {
      await permissionsApi.create({
        key: newPerm.key.trim(),
        label: newPerm.label.trim(),
        module: newPerm.module.trim() || undefined,
      });
      setPermissions((prev) => [...prev, { ...newPerm }]);
      setNewPerm({ key: '', label: '', module: '' });
      toast({ title: 'Permission created' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  }

  async function deletePermission(key: string) {
    try {
      await permissionsApi.remove(key);
      setPermissions((prev) => prev.filter((p) => p.key !== key));
      toast({ title: 'Permission removed' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  }

  return (
    <PermissionGate superAdmin fallback={true}>
      <div className="w-full space-y-5 sm:space-y-6 pb-8 min-w-0">
        <div>
          <h1 className="text-2xl font-semibold font-display">System Settings</h1>
          <p className="text-sm text-muted-foreground">Platform backoffice — global theme and permission catalog.</p>
        </div>

        <Tabs defaultValue="theme">
          <TabsList>
            <TabsTrigger value="theme" className="gap-1.5"><Palette className="h-3.5 w-3.5" /> Theme</TabsTrigger>
            <TabsTrigger value="permissions" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="theme" className="space-y-6 mt-4">
            <FormSection title="Global theme" description="Choose a color palette for the whole platform. Workspace overrides can differ per customer.">
              <ThemePalettePicker
                value={globalTheme}
                onChange={setGlobalTheme}
                onPreview={applyTheme}
              />
              <ThemePreviewStrip theme={globalTheme} />
              <Field label="Color mode">
                <select
                  className="flex h-11 w-full rounded-lg border border-border/60 bg-muted/30 px-3.5 text-sm shadow-sm"
                  value={globalTheme.mode ?? 'light'}
                  onChange={(e) => {
                    const next = { ...globalTheme, mode: e.target.value as ThemeConfig['mode'] };
                    setGlobalTheme(next);
                    applyTheme(next);
                  }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => setShowGlobalAdvanced((v) => !v)}
              >
                {showGlobalAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced — custom HSL values
              </Button>
              {showGlobalAdvanced && (
                <FormRow>
                  {THEME_FIELDS.map(({ key, label, placeholder }) => (
                    <Field key={key} label={label}>
                      <FormInput
                        value={globalTheme[key] ?? ''}
                        onChange={(e) => {
                          const next = { ...globalTheme, [key]: e.target.value };
                          setGlobalTheme(next);
                          applyTheme(next);
                        }}
                        placeholder={placeholder}
                      />
                    </Field>
                  ))}
                </FormRow>
              )}
              <Button onClick={saveGlobalTheme} disabled={savingTheme} className="gap-1.5 h-10 rounded-lg">
                <Save className="h-4 w-4" /> Save global theme
              </Button>
            </FormSection>

            {tenant && (
              <FormSection title={`Workspace override — ${tenant.name}`} description="Optional palette for this workspace only.">
                <ThemePalettePicker
                  value={tenantTheme}
                  onChange={setTenantTheme}
                  onPreview={(t) => applyTheme({ ...globalTheme, ...t })}
                />
                <ThemePreviewStrip theme={tenantTheme} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setShowTenantAdvanced((v) => !v)}
                >
                  {showTenantAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Advanced — custom HSL values
                </Button>
                {showTenantAdvanced && (
                  <FormRow>
                    {THEME_FIELDS.map(({ key, label, placeholder }) => (
                      <Field key={key} label={label}>
                        <FormInput
                          value={tenantTheme[key] ?? ''}
                          onChange={(e) => {
                            const next = { ...tenantTheme, [key]: e.target.value };
                            setTenantTheme(next);
                            applyTheme({ ...globalTheme, ...next });
                          }}
                          placeholder={placeholder}
                        />
                      </Field>
                    ))}
                  </FormRow>
                )}
                <Button variant="outline" onClick={saveTenantTheme} disabled={savingTheme} className="gap-1.5 h-10 rounded-lg">
                  <Save className="h-4 w-4" /> Save workspace theme
                </Button>
              </FormSection>
            )}
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4 mt-4">
            {!isSuperAdmin && (
              <p className="text-sm text-muted-foreground">Only system admins can add or remove permission keys.</p>
            )}
            <div className="rounded-xl border bg-card divide-y">
              {permissions.map((p) => (
                <div key={p.key} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs font-mono text-muted-foreground">{p.key}</p>
                  </div>
                  {isSuperAdmin && (
                    <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => deletePermission(p.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {isSuperAdmin && (
              <FormSection title="Add permission key">
                <FormRow cols={3}>
                  <Field label="Key"><FormInput placeholder="module.action" value={newPerm.key} onChange={(e) => setNewPerm((p) => ({ ...p, key: e.target.value }))} /></Field>
                  <Field label="Label"><FormInput placeholder="Label" value={newPerm.label} onChange={(e) => setNewPerm((p) => ({ ...p, label: e.target.value }))} /></Field>
                  <Field label="Module"><FormInput placeholder="module" value={newPerm.module} onChange={(e) => setNewPerm((p) => ({ ...p, module: e.target.value }))} /></Field>
                </FormRow>
                <Button size="sm" onClick={addPermission} className="gap-1 h-9 rounded-lg"><Plus className="h-3.5 w-3.5" /> Add</Button>
              </FormSection>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
