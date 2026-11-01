import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { backofficeApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { confirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/hooks/use-toast";

type Refund = Awaited<ReturnType<typeof backofficeApi.listRefunds>>[number];

export function BackofficeRefundsTab() {
  const { toast } = useToast();
  const [refunds, setRefunds] = useState<Refund[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = () =>
    backofficeApi
      .listRefunds()
      .then(setRefunds)
      .catch((e: Error) => setError(e.message || "Could not load refunds"));

  useEffect(() => {
    void load();
  }, []);

  const decide = async (refund: Refund, approve: boolean) => {
    if (approve) {
      const confirmed = await confirmModal(
        `This sends ${refund.amount} ${refund.deposit?.currency ?? ""} back to ${refund.tenant?.name ?? "the tenant"}.`,
        "Approve refund?",
        "Approve refund",
      );
      if (!confirmed) return;
    }
    setBusyId(refund.id);
    try {
      if (approve) await backofficeApi.approveRefund(refund.id);
      else await backofficeApi.rejectRefund(refund.id, notes[refund.id]);
      await load();
    } catch (e) {
      toast({
        title: "Couldn't update this refund",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!refunds) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund requests</CardTitle>
        <CardDescription>Approving a refund sends the money back to the tenant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No refund requests.</p>
        ) : (
          refunds.map((refund) => {
            const pending = refund.status === "PENDING";
            return (
              <div key={refund.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm">
                    {refund.tenant?.name ?? "Unknown tenant"} · {refund.amount} {refund.deposit?.currency ?? ""}
                  </p>
                  <Badge variant={pending ? "default" : "secondary"}>{refund.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{refund.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Requested {new Date(refund.created_at).toLocaleDateString()}
                  {refund.adminNotes ? ` · ${refund.adminNotes}` : ""}
                </p>
                {pending && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-label="Rejection note"
                      placeholder="Reason, if rejecting"
                      value={notes[refund.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [refund.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busyId === refund.id} onClick={() => void decide(refund, true)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === refund.id}
                        onClick={() => void decide(refund, false)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
