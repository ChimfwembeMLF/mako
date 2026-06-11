import { useEffect, useState } from 'react';
import { BarChart3, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { notificationsApi, type ReportCatalogItem } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content',
  leads: 'Leads',
  billing: 'Billing',
  engagement: 'Engagement',
  chatbot: 'Chatbot',
};

type ExportFormat = 'pdf' | 'csv' | 'xlsx';

export default function ReportsPage() {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    notificationsApi.reportCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const runReport = async (reportId: string) => {
    if (!tenant?.id) return;
    setSelected(reportId);
    setLoading(true);
    setReportData(null);
    try {
      const data = await notificationsApi.generateReport(tenant.id, reportId);
      setReportData(data);
    } catch {
      setReportData({ error: 'Failed to generate report' });
    } finally {
      setLoading(false);
    }
  };

  const downloadExport = async (format: ExportFormat) => {
    if (!tenant?.id || !selected) return;
    setExporting(format);
    try {
      await notificationsApi.downloadReport(tenant.id, selected, format);
      toast({
        title: 'Download started',
        description: `Report saved as ${format.toUpperCase()}.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Could not download report',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  const grouped = catalog.reduce<Record<string, ReportCatalogItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const selectedName = catalog.find((c) => c.id === selected)?.name;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Reports</h1>
          <p className="text-sm text-muted-foreground">
            On-demand insights — export as PDF, Excel, or CSV
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      'cursor-pointer transition-all hover:border-primary/40',
                      selected === item.id && 'border-primary ring-1 ring-primary/20',
                    )}
                    onClick={() => void runReport(item.id)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <CardDescription className="text-xs">{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Card className="lg:sticky lg:top-4 h-fit min-h-[16rem]">
          <CardHeader>
            <CardTitle className="text-base">Report output</CardTitle>
            <CardDescription>
              {selectedName ?? 'Select a report to generate'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </div>
            ) : reportData ? (
              <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-auto max-h-[24rem] whitespace-pre-wrap">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Pick a report on the left, then download in your preferred format.
              </p>
            )}

            {reportData && !loading && selected && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!!exporting}
                  onClick={() => void downloadExport('pdf')}
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!exporting}
                  onClick={() => void downloadExport('xlsx')}
                >
                  {exporting === 'xlsx' ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!exporting}
                  onClick={() => void downloadExport('csv')}
                >
                  {exporting === 'csv' ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : null}
                  CSV
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed bg-muted/20">
        <CardContent className="p-5 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Export formats</p>
          <div className="flex flex-wrap gap-2">
            {['PDF — printable summary', 'Excel (.xlsx) — spreadsheets', 'CSV — raw data'].map(
              (t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
