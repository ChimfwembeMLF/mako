import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { backofficeApi, type PublicPlan } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type PlanDraft = PublicPlan;

const EMPTY: PlanDraft[] = [];

export function BackofficePlansTab({ onSaved }: { onSaved?: (plans: PublicPlan[]) => void }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanDraft[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    backofficeApi
      .getPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const updatePlan = (key: PublicPlan["key"], patch: Partial<PlanDraft>) => {
    setPlans((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        plans.map((p) => [
          p.key,
          {
            label: p.label,
            priceZmw: p.priceZmw,
            aiCallsLimit: p.aiCallsLimit,
            seatLimit: p.seatLimit,
            tenantLimit: p.tenantLimit,
            dailyWorkflowEnabled: p.dailyWorkflowEnabled,
            highlight: p.highlight,
            features: p.features,
          },
        ]),
      );
      const updated = await backofficeApi.updatePlans(payload);
      setPlans(updated);
      onSaved?.(updated);
      toast({ title: "Plans updated", description: "Landing page, billing, and payments use the new pricing." });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not update plans",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading plans…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Billing plans</h2>
          <p className="text-sm text-muted-foreground">
            Changes apply to the landing page, in-app billing, mobile-money checkout, and invoices.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save plans
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">{plan.key}</CardTitle>
              <CardDescription>Edit public plan details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Display name</Label>
                <Input value={plan.label} onChange={(e) => updatePlan(plan.key, { label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Price (ZMW / month)</Label>
                <Input
                  type="number"
                  min={0}
                  value={plan.priceZmw}
                  onChange={(e) => updatePlan(plan.key, { priceZmw: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>AI calls limit</Label>
                  <Input
                    placeholder="∞ empty"
                    value={plan.aiCallsLimit ?? ""}
                    onChange={(e) =>
                      updatePlan(plan.key, {
                        aiCallsLimit: e.target.value === "" ? null : Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Seat limit</Label>
                  <Input
                    placeholder="∞ empty"
                    value={plan.seatLimit ?? ""}
                    onChange={(e) =>
                      updatePlan(plan.key, {
                        seatLimit: e.target.value === "" ? null : Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label>Daily workflow</Label>
                <Switch
                  checked={plan.dailyWorkflowEnabled}
                  onCheckedChange={(v) => updatePlan(plan.key, { dailyWorkflowEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label>Highlight on pricing</Label>
                <Switch
                  checked={plan.highlight}
                  onCheckedChange={(v) => updatePlan(plan.key, { highlight: v })}
                />
              </div>
              <div className="space-y-1">
                <Label>Feature bullets (one per line)</Label>
                <Textarea
                  rows={4}
                  value={plan.features.join("\n")}
                  onChange={(e) =>
                    updatePlan(plan.key, {
                      features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
