import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { backofficeApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Report = Awaited<ReturnType<typeof backofficeApi.listSubscriptions>>;
type Row = Report["rows"][number];

const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "past_due", label: "Past due", match: (r: Row) => r.status === "past_due" },
  { id: "expiring", label: "Expiring soon", match: (r: Row) => r.expiringSoon },
  { id: "paying", label: "Paying", match: (r: Row) => r.status === "active" && r.monthlyPriceZmw > 0 },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const STATUS_LABELS: Record<string, string> = { past_due: "Past due", active: "Active", cancelled: "Cancelled" };

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

/** Quotes each cell, and neutralises anything a spreadsheet would run as a formula. */
export function toCsv(rows: Row[]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["Tenant", "Owner", "Plan", "Status", "Monthly ZMW", "Renews or ends", "Auto-renew", "Failed attempts"];
  const lines = rows.map((r) =>
    [
      r.tenantName,
      r.ownerEmail,
      r.plan,
      r.status,
      r.monthlyPriceZmw,
      r.billingPeriodEnd?.slice(0, 10),
      r.autoRenewEnabled ? "On" : "Off",
      r.renewalAttempts,
    ]
      .map(cell)
      .join(","),
  );
  return [header.map(cell).join(","), ...lines].join("\n");
}

function downloadCsv(rows: Row[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "subscriptions.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export function BackofficeSubscriptionsTab({ onOpenTenant }: { onOpenTenant: (id: string) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    backofficeApi
      .listSubscriptions()
      .then(setReport)
      .catch((e: Error) => setError(e.message || "Could not load subscriptions"));
  }, []);

  const rows = useMemo(() => {
    const active = FILTERS.find((f) => f.id === filter)!;
    const query = search.trim().toLowerCase();
    return (report?.rows ?? []).filter(
      (row) =>
        active.match(row) &&
        (!query ||
          row.tenantName.toLowerCase().includes(query) ||
          row.ownerEmail?.toLowerCase().includes(query)),
    );
  }, [report, filter, search]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!report) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />;

  const { summary } = report;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Paying tenants" value={summary.paying} />
        <Stat label="Monthly revenue" value={`ZMW ${summary.mrrZmw}`} />
        <Stat label="Past due" value={summary.pastDue} />
        <Stat label="Expiring in 7 days" value={summary.expiringSoon} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Past due and expiring tenants are listed first. Click a row for details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? "default" : "outline"}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" disabled={rows.length === 0} onClick={() => downloadCsv(rows)}>
              Export CSV
            </Button>
            <Input
              className="sm:max-w-xs sm:ml-auto"
              placeholder="Search tenant or owner email"
              aria-label="Search subscriptions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No subscriptions match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Tenant</th>
                    <th className="pb-2 pr-4">Plan</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Renews / ends</th>
                    <th className="pb-2 pr-4">Auto-renew</th>
                    <th className="pb-2">Failed attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.tenantId}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                      onClick={() => onOpenTenant(row.tenantId)}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">{row.tenantName}</div>
                        <div className="text-xs text-muted-foreground">{row.ownerEmail ?? "—"}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="capitalize">{row.plan}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={row.status === "past_due" ? "destructive" : row.status === "active" ? "default" : "secondary"}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {row.monthlyPriceZmw > 0 ? formatDate(row.billingPeriodEnd) : "—"}
                        {row.expiringSoon ? <Badge variant="secondary" className="ml-2">Soon</Badge> : null}
                      </td>
                      <td className="py-3 pr-4">{row.monthlyPriceZmw > 0 ? (row.autoRenewEnabled ? "On" : "Off") : "—"}</td>
                      <td className="py-3">{row.renewalAttempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
