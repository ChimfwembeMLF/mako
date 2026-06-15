import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  PenLine,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';
import { brandProfilesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BrandForm {
  company_name: string;
  description: string;
}

const STEPS = [
  {
    icon: Brain,
    title: 'Brand Brain',
    description: 'Voice, audience, and guardrails for every post.',
  },
  {
    icon: PenLine,
    title: 'Content Engine',
    description: 'Generate on-brand copy for every channel.',
  },
  {
    icon: Rocket,
    title: 'Publish',
    description: 'Schedule and ship from one dashboard.',
  },
] as const;

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaces } = useWorkspace();
  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspace)?.name;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BrandForm>({ company_name: '', description: '' });

  function close(skip = false) {
    if (skip) {
      onComplete();
      return;
    }
    onComplete();
  }

  async function save() {
    if (!user || !tenant || !form.company_name.trim()) return;
    setSaving(true);
    try {
      await brandProfilesApi.save({
        tenantId: tenant.id,
        workspaceId: activeWorkspace ?? undefined,
        companyName: form.company_name.trim(),
        description: form.description.trim() || undefined,
      });
      toast({
        title: 'Brand Brain started',
        description: 'You can add more detail anytime in Brand Brain.',
      });
      close();
      navigate('/brand-brain');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(true); }}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden border-border/60 p-0 sm:rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 pb-8 pt-6 text-primary-foreground">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 left-1/4 h-24 w-24 rounded-full bg-white/10 blur-xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-display font-semibold text-primary-foreground">
                  Welcome to Mako
                </DialogTitle>
                <DialogDescription className="text-sm text-primary-foreground/85 mt-0.5">
                  {activeWorkspaceName
                    ? `Set up “${activeWorkspaceName}” in under a minute.`
                    : 'Set up your workspace in under a minute.'}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-lg p-1.5 text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground"
              aria-label="Skip onboarding"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-6 flex gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  step >= i ? 'bg-white' : 'bg-white/30',
                )}
              />
            ))}
          </div>
        </div>

        {step === 0 ? (
          <div className="space-y-5 px-6 py-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Mako learns your brand once, then helps you create, schedule, and reply — all from one place.
            </p>

            <div className="space-y-2.5">
              {STEPS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => close(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
              <Button onClick={() => setStep(1)} className="gap-2">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-6 py-6">
            <div>
              <h3 className="text-base font-semibold font-display">Tell us about your brand</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add your website or upload a brand doc later in Brand Brain.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboarding-company">Company name</Label>
                <Input
                  id="onboarding-company"
                  autoFocus
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder="Acme Corp"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && form.company_name.trim()) void save();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="onboarding-description">
                  What you do
                  <span className="text-muted-foreground font-normal"> (optional)</span>
                </Label>
                <Textarea
                  id="onboarding-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="We build cloud software for SMEs…"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => close(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  Skip
                </button>
                <Button
                  onClick={() => void save()}
                  disabled={saving || !form.company_name.trim()}
                  className="gap-2"
                >
                  {saving ? 'Saving…' : 'Continue to Brand Brain'}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function useNeedsOnboarding() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion, loading: workspaceLoading } = useWorkspace();
  const [needs, setNeeds] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('onboarding_dismissed') === '1',
  );

  useEffect(() => {
    if (!user || !tenant || dismissed || workspaceLoading) {
      if (!user || !tenant || dismissed) setChecked(true);
      return;
    }

    let cancelled = false;
    brandProfilesApi
      .getMine(tenant.id, activeWorkspace ?? undefined)
      .then((profile) => {
        if (cancelled) return;
        const hasBrandBrain = Boolean(profile?.companyName?.trim() || profile?.description?.trim());
        setNeeds(!hasBrandBrain);
        setChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setNeeds(false);
        setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user, tenant, dismissed, activeWorkspace, workspaceVersion, workspaceLoading]);

  const dismiss = () => {
    localStorage.setItem('onboarding_dismissed', '1');
    setDismissed(true);
    setNeeds(false);
  };

  return { needs: checked && needs, dismiss };
}
