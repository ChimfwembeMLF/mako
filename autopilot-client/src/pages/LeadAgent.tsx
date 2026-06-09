import { useState, useEffect, useRef } from "react";
import { MessageSquare, UserCheck, AlertTriangle, Star, Clock, Send, ArrowUpRight, Globe, Copy, Check, Zap, ExternalLink, Mail, MailX, Phone, UserPlus, Trash2, PhoneOff } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RichTextEditor from "@/components/RichTextEditor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL, leadsApi, leadSourcesApi, whatsappContactsApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import BulkEmailSheet from "@/components/BulkEmailDialog";
import EmailTemplates from "@/components/EmailTemplates";

interface Lead {
  id: string;
  name: string;
  email: string;
  source: string;
  message: string | null;
  classification: string;
  status: string;
  ai_reply: string | null;
  created_at: string;
  unsubscribed?: boolean;
}

const classColors: Record<string, string> = {
  hot: "bg-destructive/10 text-destructive",
  warm: "bg-primary/10 text-primary",
  cold: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  new: "New", qualifying: "Qualifying", qualified: "Qualified",
  meeting_booked: "Meeting Booked", escalated: "Escalated",
};

const statusColors: Record<string, string> = {
  new: "bg-secondary/20 text-secondary-foreground", qualifying: "bg-primary/10 text-primary",
  qualified: "bg-green-100 text-green-700", meeting_booked: "bg-accent text-accent-foreground",
  escalated: "bg-destructive/10 text-destructive",
};

interface WhatsAppContact {
  id: string; phone: string; name: string | null; opted_in: boolean;
  opted_in_at: string | null; tags: string[]; created_at: string;
}

const LeadAgent = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [leadSource, setLeadSource] = useState<{ id: string; webhook_secret: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [replySheetOpen, setReplySheetOpen] = useState(false);
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  // WhatsApp state
  const [waContacts, setWaContacts] = useState<WhatsAppContact[]>([]);
  const [waPhone, setWaPhone] = useState("");
  const [waName, setWaName] = useState("");
  const [waLoading, setWaLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();

  useEffect(() => {
    if (!user || !tenant) return;
    loadLeads();
    loadLeadSource();
  }, [user, tenant]);
  useEffect(() => { if (tenant) loadWaContacts(); }, [tenant]);

  const loadLeadSource = async () => {
    if (!user || !tenant) return;
    try {
      const all = await leadSourcesApi.findAll();
      const list = Array.isArray(all) ? all : [];
      let source = list.find(
        (s: Record<string, unknown>) => s.userId === user.id && s.label === "Default",
      );
      if (!source) {
        source = await leadSourcesApi.create({
          tenantId: tenant.id,
          userId: user.id,
          label: "Default",
        } as any);
      }
      if (source) {
        setLeadSource({
          id: String(source.id),
          webhook_secret: String(source.webhookSecret ?? ""),
        });
      }
    } catch {
      /* lead source unavailable */
    }
  };

  const loadWaContacts = async () => {
    if (!tenant) return;
    try {
      const all = await whatsappContactsApi.findAll();
      const list = Array.isArray(all) ? all : [];
      setWaContacts(
        list
          .filter((c: Record<string, unknown>) => c.tenantId === tenant.id)
          .map((c: Record<string, unknown>) => ({
            id: String(c.id),
            phone: String(c.phone),
            name: c.name != null ? String(c.name) : null,
            opted_in: Boolean(c.optedIn),
            opted_in_at: c.optedInAt != null ? String(c.optedInAt) : null,
            tags: (c.tags as string[]) ?? [],
            created_at: String(c.created_at ?? ""),
          })),
      );
    } catch {
      setWaContacts([]);
    }
  };

  const addWaContact = async () => {
    if (!waPhone.trim() || !tenant) return;
    setWaLoading(true);
    try {
      await whatsappContactsApi.create({
        tenantId: tenant.id,
        phone: waPhone.trim(),
        name: waName.trim() || undefined,
        optedIn: false,
      } as any);
      toast({ title: "Contact added" });
      setWaPhone("");
      setWaName("");
      loadWaContacts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setWaLoading(false);
  };

  const toggleOptIn = async (id: string, current: boolean) => {
    await whatsappContactsApi.update(id, {
      optedIn: !current,
      optedInAt: !current ? new Date().toISOString() : null,
    } as any);
    setWaContacts(prev => prev.map(c => c.id === id ? { ...c, opted_in: !current } : c));
  };

  const deleteWaContact = async (id: string) => {
    await whatsappContactsApi.remove(id);
    setWaContacts(prev => prev.filter(c => c.id !== id));
    toast({ title: "Contact removed" });
  };

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    const text = await file.text();
    const lines = text.split("\n").slice(1).filter(Boolean);
    let imported = 0;
    for (const line of lines) {
      const [phone, name] = line.split(",").map(s => s.replace(/^"|"$/g, "").trim());
      if (!phone) continue;
      try {
        await whatsappContactsApi.create({
          tenantId: tenant.id,
          phone,
          name: name ?? undefined,
          optedIn: false,
        } as any);
        imported++;
      } catch {
        /* skip duplicate or invalid */
      }
    }
    toast({ title: `${imported} contacts imported` });
    loadWaContacts();
    if (fileRef.current) fileRef.current.value = "";
  };

  const loadLeads = async () => {
    if (!user) return;
    try {
      const all = await leadsApi.findAll();
      const list = Array.isArray(all) ? all : [];
      setLeads(
        list
          .filter((l: Record<string, unknown>) => l.userId === user.id)
          .map((l: Record<string, unknown>) => ({
            id: String(l.id),
            name: String(l.name),
            email: String(l.email),
            source: String(l.source),
            message: l.message != null ? String(l.message) : null,
            classification: String(l.classification ?? "cold"),
            status: String(l.status ?? "new"),
            ai_reply: l.aiReply != null ? String(l.aiReply) : null,
            created_at: String(l.created_at ?? ""),
            unsubscribed: Boolean(l.unsubscribed),
          })),
      );
    } catch {
      setLeads([]);
    }
  };

  const filtered = filterClass === "all" ? leads : leads.filter((l) => l.classification === filterClass);

  const handleReply = async () => {
    if (!selectedLead || !replyText.trim()) return;
    await leadsApi.update(selectedLead.id, { aiReply: replyText, status: "qualifying" } as any);
    toast({ title: "Reply saved", description: `Reply saved for ${selectedLead.name}` });
    setReplyText("");
    loadLeads();
  };

  const handleSendEmail = async (lead: Lead) => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ title: "Missing fields", description: "Subject and body are required", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const res = await invokeEdgeFunction("send-lead-email", {
        body: { leadId: lead.id, subject: emailSubject, htmlBody: emailBody },
      });
      const result = res.data as { success?: boolean; error?: string } | null;
      if (result?.success) {
        toast({ title: "Email sent!", description: `Email sent to ${lead.email}` });
        setEmailSubject("");
        setEmailBody("");
      } else {
        toast({ title: "Email failed", description: result?.error || res.error?.message || "Unknown error", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to send email", variant: "destructive" });
    }
    setSendingEmail(false);
  };

  const handleClassify = async (id: string, classification: string) => {
    await leadsApi.update(id, { classification } as any);
    loadLeads();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await leadsApi.update(id, { status } as any);
    loadLeads();
    if (status === "meeting_booked") {
      toast({ title: "Meeting booked!", description: "Lead marked as meeting booked." });
    }
    if (status === "escalated") {
      toast({ title: "Lead escalated", description: "High-value lead flagged for manual review." });
    }
  };

  const webhookUrl = `${API_BASE_URL}/api/v1/leads/webhook`;
  const contactFormUrl = `/contact/${user?.id || ""}`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const stats = {
    total: leads.length,
    hot: leads.filter((l) => l.classification === "hot").length,
    meetings: leads.filter((l) => l.status === "meeting_booked").length,
    new: leads.filter((l) => l.status === "new").length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-secondary">
          <MessageSquare className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Lead Agent</h1>
          <p className="text-muted-foreground text-sm">Auto-classify, reply, qualify, and book meetings</p>
        </div>
      </div>

      {/* Integration Info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Lead Capture Endpoints</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{webhookUrl}</code>
              <Button size="sm" variant="ghost" className="h-7" onClick={copyWebhook}>
                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              POST JSON with <code>name</code>, <code>email</code>, <code>message</code>, and <code>source_id: "{leadSource?.id?.slice(0, 8) ?? "..."}..."</code>.
              Include header <code>X-Webhook-Secret: {leadSource ? "••••••••" : "(loading)"}</code>.
              AI will auto-classify and generate a reply.
            </p>
            <div className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">Embeddable contact form: <code className="bg-muted px-1 py-0.5 rounded">/contact/{user?.id?.slice(0, 8)}...</code></span>
            </div>
            {leadSource && (
              <div className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <Button
                  size="sm" variant="ghost" className="h-6 text-xs text-primary p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(leadSource.webhook_secret);
                    toast({ title: "Secret copied!" });
                  }}
                >
                  Copy webhook secret
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: stats.total, icon: UserCheck, color: "text-foreground" },
          { label: "Hot Leads", value: stats.hot, icon: Star, color: "text-destructive" },
          { label: "Meetings Booked", value: stats.meetings, icon: Clock, color: "text-primary" },
          { label: "New / Unread", value: stats.new, icon: AlertTriangle, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp ({waContacts.filter(c => c.opted_in).length} opted in)</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4 mt-4">
      {/* Filter */}
      <div className="flex gap-2 items-center flex-wrap">
        <BulkEmailSheet leads={leads} />
        {["all", "hot", "warm", "cold"].map((f) => (
          <Button key={f} size="sm" variant={filterClass === f ? "default" : "outline"} onClick={() => setFilterClass(f)}
            className={filterClass === f ? "gradient-primary text-primary-foreground border-0" : ""}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Lead List */}
      <div className="space-y-3">
        {leads.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              No leads yet. Share your webhook URL or contact form to start receiving leads.
            </CardContent>
          </Card>
        ) : filtered.map((lead) => (
          <Card key={lead.id} className="border-border/50 hover:shadow-card transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{lead.name}</h3>
                    <Badge className={`text-[10px] ${classColors[lead.classification] || "bg-muted text-muted-foreground"}`}>
                      {lead.classification.toUpperCase()}
                    </Badge>
                    <Badge className={`text-[10px] ${statusColors[lead.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[lead.status] || lead.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{lead.email} • via {lead.source}</p>
                  {lead.message && <p className="text-sm text-foreground">{lead.message}</p>}
                  {lead.ai_reply && (
                    <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">🤖 AI Reply:</p>
                      <p className="text-sm">{lead.ai_reply}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(lead.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {lead.unsubscribed && (
                    <Badge className="text-[10px] bg-muted text-muted-foreground mb-1"><MailX className="h-3 w-3 mr-1" /> Unsubscribed</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSelectedLead(lead);
                      setReplyText(lead.ai_reply || "");
                      setReplySheetOpen(true);
                    }}
                  >
                    <Send className="h-3 w-3 mr-1" /> Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={lead.unsubscribed}
                    onClick={() => {
                      setSelectedLead(lead);
                      setEmailSubject("");
                      setEmailBody(lead.ai_reply || "");
                      setEmailSheetOpen(true);
                    }}
                  >
                    <Mail className="h-3 w-3 mr-1" /> Email
                  </Button>
                  {lead.status !== "meeting_booked" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatusChange(lead.id, "meeting_booked")}>
                      <Clock className="h-3 w-3 mr-1" /> Book
                    </Button>
                  )}
                  {lead.classification !== "hot" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleClassify(lead.id, "hot")}>
                      <Star className="h-3 w-3 mr-1" /> Hot
                    </Button>
                  )}
                  {lead.status !== "escalated" && lead.classification === "hot" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatusChange(lead.id, "escalated")}>
                      <ArrowUpRight className="h-3 w-3 mr-1" /> Escalate
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          {/* Add contact */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="font-medium text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-green-500"/>Add WhatsApp Contact</p>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <div><input className="w-full h-9 rounded-md border bg-background px-3 text-sm" placeholder="+260 97X XXX XXX" value={waPhone} onChange={e=>setWaPhone(e.target.value)} /></div>
                <div><input className="w-full h-9 rounded-md border bg-background px-3 text-sm" placeholder="Name (optional)" value={waName} onChange={e=>setWaName(e.target.value)} /></div>
                <Button size="sm" onClick={addWaContact} disabled={waLoading||!waPhone.trim()} className="gap-1"><UserPlus className="h-3.5 w-3.5"/>Add</Button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCsv}/>
                <Button variant="outline" size="sm" onClick={()=>fileRef.current?.click()} className="gap-1 text-xs">Import CSV (phone, name)</Button>
                <span className="text-xs text-muted-foreground">CSV format: phone,name (one per line, first row = header)</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Contacts", value: waContacts.length },
              { label: "Opted In", value: waContacts.filter(c=>c.opted_in).length },
              { label: "Opted Out", value: waContacts.filter(c=>!c.opted_in).length },
            ].map(s=>(
              <Card key={s.label} className="border-border/50"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* Contact list */}
          <div className="space-y-2">
            {waContacts.length === 0 && <Card className="border-border/50"><CardContent className="p-8 text-center text-muted-foreground text-sm">No WhatsApp contacts yet.</CardContent></Card>}
            {waContacts.map(c=>(
              <Card key={c.id} className="border-border/50">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${c.opted_in?'bg-green-500':'bg-muted-foreground'}`}>
                      {c.opted_in ? '✓' : '—'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.name ?? c.phone}</p>
                      {c.name && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.opted_in?"default":"outline"} className={`text-[10px] ${c.opted_in?'bg-green-600':''}`}>
                      {c.opted_in?'Opted In':'Opted Out'}
                    </Badge>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>toggleOptIn(c.id,c.opted_in)}>
                      {c.opted_in?<><PhoneOff className="h-3 w-3 mr-1"/>Opt Out</>:<><Phone className="h-3 w-3 mr-1"/>Opt In</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={()=>deleteWaContact(c.id)}>
                      <Trash2 className="h-3.5 w-3.5"/>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={replySheetOpen} onOpenChange={setReplySheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Reply to {selectedLead?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {selectedLead?.message && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="text-muted-foreground text-xs mb-1">Their message:</p>
                {selectedLead.message}
              </div>
            )}
            <RichTextEditor value={replyText} onChange={setReplyText} placeholder="Type your reply..." minHeight="80px" />
            <Button
              onClick={async () => {
                await handleReply();
                setReplySheetOpen(false);
              }}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              <Send className="mr-2 h-4 w-4" /> Save Reply
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={emailSheetOpen} onOpenChange={setEmailSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Email {selectedLead?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">To: {selectedLead?.email}</p>
              {selectedLead && (
                <EmailTemplates
                  leadName={selectedLead.name}
                  onSelect={(subject, body) => { setEmailSubject(subject); setEmailBody(body); }}
                />
              )}
            </div>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Subject line..."
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
            <RichTextEditor value={emailBody} onChange={setEmailBody} placeholder="Email body..." minHeight="120px" />
            <p className="text-xs text-muted-foreground">An unsubscribe link will be added automatically.</p>
            <Button
              onClick={async () => {
                if (selectedLead) await handleSendEmail(selectedLead);
                setEmailSheetOpen(false);
              }}
              disabled={sendingEmail}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              <Mail className="mr-2 h-4 w-4" /> {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LeadAgent;
