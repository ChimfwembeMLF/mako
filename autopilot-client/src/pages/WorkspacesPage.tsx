import { useState, useEffect } from 'react';
import { useTenant } from '@/hooks/useTenant';
import { workspacesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FormSection, FormRow, FormActions, FormInput } from '@/components/forms';
import { useToast } from '@/hooks/use-toast';
import { Building2 } from 'lucide-react';

export default function WorkspacesPage() {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tenant) fetchWorkspaces();
  }, [tenant]);

  async function fetchWorkspaces() {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await workspacesApi.findAll(tenant.id);
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setLoading(true);
    try {
      if (editingId) {
        await workspacesApi.update(editingId, { name, slug, logoUrl: logoUrl || undefined });
        toast({ title: 'Workspace updated' });
      } else {
        await workspacesApi.create({ tenantId: tenant.id, name, slug, logoUrl: logoUrl || undefined });
        toast({ title: 'Workspace created' });
      }
      setName('');
      setSlug('');
      setLogoUrl('');
      setEditingId(null);
      fetchWorkspaces();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(ws: any) {
    setEditingId(ws.id);
    setName(ws.name);
    setSlug(ws.slug);
    setLogoUrl(ws.logoUrl ?? '');
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await workspacesApi.remove(id);
      toast({ title: 'Workspace deleted' });
      fetchWorkspaces();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <FormSection title={editingId ? 'Edit workspace' : 'New workspace'} description="Organize content by brand or client.">
          <form onSubmit={handleSave} className="space-y-4">
            <FormRow>
              <Field label="Name" required>
                <FormInput icon={Building2} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Marketing" />
              </Field>
              <Field label="Slug" required hint="URL-safe identifier">
                <FormInput value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="marketing" />
              </Field>
            </FormRow>
            <Field label="Logo URL" hint="Optional">
              <FormInput value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <FormActions>
              <Button type="submit" disabled={loading || !tenant} className="h-10 rounded-lg">
                {loading ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </Button>
            </FormActions>
          </form>
      </FormSection>

      <Card>
        <CardHeader><CardTitle>Workspaces</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspaces yet.</p>
          ) : workspaces.map((ws) => (
            <div key={ws.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <p className="font-medium">{ws.name}</p>
                <p className="text-xs text-muted-foreground">{ws.slug}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(ws)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(ws.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
