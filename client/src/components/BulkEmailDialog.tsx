import { useState } from "react";
import { Mail, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RichTextEditor from "@/components/RichTextEditor";
import EmailTemplates from "@/components/EmailTemplates";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

interface Lead {
  id: string;
  name: string;
  email: string;
  classification: string;
  unsubscribed?: boolean;
}

interface BulkEmailSheetProps {
  leads: Lead[];
}

const BulkEmailSheet = ({ leads }: BulkEmailSheetProps) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const { toast } = useToast();

  const eligible = leads.filter(
    (l) => !l.unsubscribed && (filter === "all" || l.classification === filter)
  );

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Missing fields", description: "Subject and body are required", variant: "destructive" });
      return;
    }
    if (eligible.length === 0) {
      toast({ title: "No recipients", description: "No eligible leads match the filter", variant: "destructive" });
      return;
    }

    setSending(true);
    setProgress({ sent: 0, failed: 0, total: eligible.length });

    let sent = 0;
    let failed = 0;

    for (const lead of eligible) {
      try {
        const personalizedBody = body.replace(/\{\{name\}\}/g, lead.name);
        const res = await invokeEdgeFunction("send-lead-email", {
          body: {
            leadId: lead.id,
            to: lead.email,
            subject,
            htmlBody: personalizedBody,
          },
        });
        const result = res.data as { success?: boolean } | null;
        if (result?.success) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setProgress({ sent, failed, total: eligible.length });
    }

    setSending(false);
    toast({
      title: "Bulk email complete",
      description: `${sent} sent, ${failed} failed out of ${eligible.length}`,
    });
    if (sent > 0) {
      setSubject("");
      setBody("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="h-4 w-4" />
          Bulk Email
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Mail className="h-5 w-5" /> Bulk Email
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Send to:</span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leads</SelectItem>
                <SelectItem value="hot">Hot leads</SelectItem>
                <SelectItem value="warm">Warm leads</SelectItem>
                <SelectItem value="cold">Cold leads</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs">
              {eligible.length} recipient{eligible.length !== 1 ? "s" : ""}
            </Badge>
            <EmailTemplates
              leadName="{{name}}"
              onSelect={(s, b) => { setSubject(s); setBody(b); }}
            />
          </div>

          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Subject line..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <RichTextEditor value={body} onChange={setBody} placeholder="Email body..." minHeight="120px" />

          <p className="text-xs text-muted-foreground">
            Unsubscribed leads are automatically excluded. An unsubscribe link is added to each email.
          </p>

          {sending && (
            <div className="text-sm text-muted-foreground">
              Sending... {progress.sent + progress.failed} / {progress.total}
              {progress.failed > 0 && (
                <span className="text-destructive ml-1">({progress.failed} failed)</span>
              )}
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || eligible.length === 0}
            className="w-full gradient-primary text-primary-foreground border-0"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending
              ? `Sending ${progress.sent + progress.failed}/${progress.total}...`
              : `Send to ${eligible.length} lead${eligible.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BulkEmailSheet;
