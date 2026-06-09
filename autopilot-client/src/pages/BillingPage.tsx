import React, { useEffect, useState } from 'react';
import { TenantBillingRecords } from '@/components/TenantBillingRecords';
import { aiUsageApi, tenantMembersApi } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PermissionGate } from '@/components/PermissionGate';
import { CreditCard, Smartphone, Zap, Users, CheckCircle2, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Subscription {
  plan: string; status: string; seat_limit: number;
  billing_period_start: string; billing_period_end: string;
  paystack_customer_id: string | null;
}

const PLANS = [
  { key: 'free',    label: 'Free',    price: 'ZMW 0',   aiLimit: 100, seats: 2,    tenants: 1,  highlight: false },
  { key: 'starter', label: 'Starter', price: 'ZMW 375', aiLimit: 500, seats: 10,   tenants: 3,  highlight: true  },
  { key: 'pro',     label: 'Pro',     price: 'ZMW 875', aiLimit: '∞', seats: '∞',  tenants: '∞',highlight: false },
];

export default function BillingPage() {
  const { tenant }   = useTenant();
  const { can }      = usePermissions();
  const { toast }    = useToast();
  const [sub, setSub]         = useState<Subscription | null>(null);
  const [aiUsed, setAiUsed]   = useState(0);
  const [seats, setSeats]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // Mobile money dialog state
  const [mmOpen, setMmOpen]           = useState(false);
  const [mmPlan, setMmPlan]           = useState('');
  const [mmPhone, setMmPhone]         = useState('');
  const [mmNetwork, setMmNetwork]     = useState('MTN_MOMO_ZMB');
  const [mmSubmitting, setMmSubmitting] = useState(false);
  const [mmDepositId, setMmDepositId] = useState<string | null>(null);

  useEffect(() => { if (tenant) load(); }, [tenant]);

  useEffect(() => {
    // Handle return from Paystack checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      toast({ title: '🎉 Payment successful!', description: 'Your plan has been upgraded. It may take a moment to reflect.' });
      window.history.replaceState({}, '', '/billing');
      setTimeout(() => load(), 2000);
    }
  }, []);

  async function load() {
    if (!tenant) return;
    setLoading(true);
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [usageAll, membersAll] = await Promise.all([
        aiUsageApi.findAll(),
        tenantMembersApi.findAll(tenant.id),
      ]);
      const usageList = (Array.isArray(usageAll) ? usageAll : []).filter(
        (u: Record<string, unknown>) =>
          u.tenantId === tenant.id && String(u.created_at ?? '') >= monthStart,
      );
      const members = (Array.isArray(membersAll) ? membersAll : []).filter(
        (m: Record<string, unknown>) => m.tenantId === tenant.id && m.isActive !== false,
      );
      setSub(null);
      setAiUsed(usageList.length);
      setSeats(members.length);
    } catch {
      setSub(null);
      setAiUsed(0);
      setSeats(0);
    }
    setLoading(false);
  }

  async function handleUpgrade(plan: string) {
    if (!tenant || plan === 'free') return;
    setUpgrading(plan);
    try {
      const res = await invokeEdgeFunction('create-checkout', {
        body: { plan, tenant_id: tenant.id },
      });
      if (res.error) throw new Error(res.error.message);
      const { authorization_url } = (res.data ?? {}) as { authorization_url: string };
      window.location.href = authorization_url;
    } catch (e: any) {
      toast({ title: 'Checkout failed', description: e.message, variant: 'destructive' });
    }
    setUpgrading(null);
  }

  function openMobileMoney(plan: string) {
    setMmPlan(plan);
    setMmPhone('');
    setMmNetwork('MTN_MOMO_ZMB');
    setMmDepositId(null);
    setMmOpen(true);
  }

  async function handleMobileMoneySubmit() {
    if (!tenant || !mmPhone.trim()) return;
    setMmSubmitting(true);
    try {
      const { data, error } = await invokeEdgeFunction('initiate-pawapay-deposit', {
        body: { plan: mmPlan, tenant_id: tenant.id, phone: mmPhone.trim(), correspondent: mmNetwork },
      });
      if (error) throw new Error(error.message);
      const result = data as { error?: string; depositId?: string } | null;
      if (result?.error) throw new Error(result.error);
      setMmDepositId(result?.depositId ?? null);
      toast({ title: 'Payment request sent!', description: 'Check your phone and approve the mobile money prompt.' });
    } catch (e: any) {
      toast({ title: 'Payment failed', description: e.message, variant: 'destructive' });
    } finally {
      setMmSubmitting(false);
    }
  }

  const currentPlan = sub?.plan ?? 'free';
  const planConfig = PLANS.find(p => p.key === currentPlan);
  const aiLimit = planConfig ? planConfig.aiLimit : 100;
  const aiPct = aiLimit === Infinity ? 0 : Math.min((aiUsed / aiLimit) * 100, 100);
  const seatLimit = planConfig && planConfig.seats !== '∞' ? planConfig.seats : sub?.seat_limit ?? 2;
  const seatPct = seatLimit === '∞' ? 0 : Math.min((seats / seatLimit) * 100, 100);
  const isAtAiLimit = aiLimit !== Infinity && aiUsed >= aiLimit;
  const isAtSeatLimit = seatLimit !== '∞' && seats >= seatLimit;

  return (
    <PermissionGate require={P.settings.billing} fallback={true}>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Billing</h1>
            <p className="text-sm text-muted-foreground">Manage your subscription and usage for {tenant?.name}.</p>
          </div>
        </div>

        {/* Current usage */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">AI Generations</p>
                {isAtAiLimit && <Badge variant="destructive" className="text-[10px]">Limit reached</Badge>}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{aiUsed} used</span>
                  <span>{aiLimit === Infinity ? 'Unlimited' : `${aiLimit} limit`}</span>
                </div>
                {aiLimit !== Infinity && (
                  <Progress value={aiPct} className={`h-2 ${isAtAiLimit ? '[&>div]:bg-destructive' : aiPct > 80 ? '[&>div]:bg-amber-500' : ''}`} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Resets end of billing period
              </p>
            </div>

            <div className="rounded-lg border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Team Seats</p>
                {isAtSeatLimit && <Badge variant="destructive" className="text-[10px]">Full</Badge>}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{seats} used</span>
                  <span>{seatLimit} seats</span>
                </div>
                <Progress value={seatPct} className={`h-2 ${isAtSeatLimit ? '[&>div]:bg-destructive' : ''}`} />
              </div>
              <p className="text-xs text-muted-foreground">Upgrade plan to add more seats.</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Plan cards */}
        <div>
          <h2 className="text-base font-semibold mb-4">Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const isCurrent = currentPlan === plan.key;
              return (
                <div key={plan.key}
                  className={`rounded-xl border p-5 space-y-4 flex flex-col
                    ${plan.highlight ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-card'}
                    ${isCurrent ? 'ring-2 ring-green-500/30 border-green-500/50' : ''}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{plan.label}</p>
                      {isCurrent && <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">Current</Badge>}
                      {plan.highlight && !isCurrent && <Badge className="text-[10px]">Popular</Badge>}
                    </div>
                    <p className="text-2xl font-bold mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  </div>
                  <ul className="space-y-2 text-sm flex-1">
                    {[
                      `${plan.aiLimit} AI generations/month`,
                      `${plan.seats} team seats`,
                      `${plan.tenants} workspace${plan.tenants === 1 ? '' : 's'}`,
                    ].map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {/* <Button
                    className="w-full"
                    variant={plan.highlight ? 'default' : 'outline'}
                    disabled={isCurrent || plan.key === 'free' || upgrading === plan.key}
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {upgrading === plan.key ? 'Redirecting…' : isCurrent ? 'Current Plan' : `Upgrade to ${plan.label}`}
                  </Button> */}
                  {plan.key !== 'free' && !isCurrent && (
                    <Button
                      className="w-full"
                      variant="ghost"
                      size="sm"
                      onClick={() => openMobileMoney(plan.key)}
                    >
                      <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                      {/* Pay with Mobile Money */}
                    {upgrading === plan.key ? 'Redirecting…' : isCurrent ? 'Current Plan' : `Upgrade to ${plan.label}`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status alerts */}
        {sub?.status === 'past_due' && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Your last payment failed. Please update your payment method to avoid service interruption.
          </div>
        )}
        {sub?.status === 'cancelled' && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Your subscription has been cancelled. Upgrade to restore full access.
          </div>
        )}
      </div>

      {/* Mobile Money Sheet */}
      <Sheet open={mmOpen} onOpenChange={(o) => { if (!mmSubmitting) setMmOpen(o); }}>
        <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Mobile Money — {PLANS.find(p => p.key === mmPlan)?.label}
            </SheetTitle>
            <SheetDescription>
              Enter your mobile number and we'll send a payment prompt to your phone.
            </SheetDescription>
          </SheetHeader>

          {mmDepositId ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-300">Waiting for approval</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Approve the payment on your phone. Your plan will activate automatically once confirmed.</p>
                </div>
              </div>
              <Button className="w-full" variant="outline" onClick={() => { setMmOpen(false); setTimeout(() => load(), 3000); }}>
                Done — I'll approve on my phone
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Mobile Network</Label>
                <Select value={mmNetwork} onValueChange={setMmNetwork}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN_MOMO_ZMB">MTN MoMo (Zambia)</SelectItem>
                    <SelectItem value="AIRTEL_OAPI_ZMB">Airtel Money (Zambia)</SelectItem>
                    <SelectItem value="ZAMTEL_ZMB">Zamtel Kwacha (Zambia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 260971234567"
                  value={mmPhone}
                  onChange={e => setMmPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Include country code, no + (e.g. 260971234567)</p>
              </div>
              <p className="text-sm font-medium">
                Amount: <span className="text-primary">{PLANS.find(p => p.key === mmPlan)?.price}/month</span>
              </p>
              <Button
                className="w-full"
                onClick={handleMobileMoneySubmit}
                disabled={mmSubmitting || !mmPhone.trim()}
              >
                {mmSubmitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                  : 'Send Payment Request'
                }
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
        {/* Billing Records Table */}
        {tenant?.id && (
          <div className="mt-8">
            <TenantBillingRecords tenantId={tenant.id} />
          </div>
        )}
    </PermissionGate>
  );
}
