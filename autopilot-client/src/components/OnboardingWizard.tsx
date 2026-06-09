import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { brandProfilesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { Field, FormInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Brain } from 'lucide-react';

interface BrandForm {
  company_name: string;
  description: string;
}

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BrandForm>({ company_name: '', description: '' });

  async function save(skip = false) {
    if (skip) {
      onComplete();
      return;
    }
    if (!user || !tenant || !form.company_name.trim()) return;
    setSaving(true);
    try {
      const all = await brandProfilesApi.findAll();
      const list = Array.isArray(all) ? all : [];
      const existing = list.find(
        (p: Record<string, unknown>) =>
          p.tenantId === tenant.id && p.userId === user.id,
      );

      const payload = {
        tenantId: tenant.id,
        userId: user.id,
        companyName: form.company_name.trim(),
        description: form.description.trim() || undefined,
      };

      if (existing?.id) {
        await brandProfilesApi.update(String(existing.id), payload);
      } else {
        await brandProfilesApi.create(payload);
      }
      toast({ title: 'Brand saved' });
      onComplete();
      navigate('/brand-brain');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) save(true); }}>
      <SheetContent side="bottom" className="rounded-t-2xl sm:max-w-md sm:mx-auto sm:mb-auto sm:mt-auto sm:rounded-xl sm:h-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <SheetTitle className="text-sm">What's your company called?</SheetTitle>
              <SheetDescription className="text-xs">
                One quick step — you can add more details later in Brand Brain.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <Field label="Company name" required>
            <FormInput
              autoFocus
              icon={Brain}
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="Acme Corp"
              onKeyDown={(e) => e.key === 'Enter' && form.company_name.trim() && save()}
            />
          </Field>

          <Field label="What you do" hint="Optional — helps AI write better content">
            <FormInput
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="We build cloud software for SMEs…"
            />
          </Field>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => save(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
            <Button
              size="sm"
              onClick={() => save()}
              disabled={saving || !form.company_name.trim()}
            >
              {saving ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function useNeedsOnboarding() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [needs, setNeeds] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('onboarding_dismissed') === '1',
  );

  useEffect(() => {
    if (!user || !tenant || dismissed) {
      setChecked(true);
      return;
    }
    brandProfilesApi
      .findAll()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const profile = list.find(
          (p: Record<string, unknown>) =>
            p.tenantId === tenant.id &&
            (p.userId === user.id || !p.userId),
        );
        const hasBrandBrain = Boolean(profile?.companyName);
        setNeeds(!hasBrandBrain);
        setChecked(true);
      })
      .catch(() => {
        setNeeds(false);
        setChecked(true);
      });
  }, [user, tenant, dismissed]);

  const dismiss = () => {
    localStorage.setItem('onboarding_dismissed', '1');
    setDismissed(true);
    setNeeds(false);
  };

  return { needs: checked && needs, dismiss };
}
