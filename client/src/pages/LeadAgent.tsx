import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, UserCheck, AlertTriangle, Star, Clock, Send, ArrowUpRight, Globe, Copy, Check, Zap, ExternalLink, Mail, MailX, Phone, UserPlus, Trash2, PhoneOff, Bot, Plus, Sparkles, Edit2 } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RichTextEditor from "@/components/RichTextEditor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL, leadsApi, leadSourcesApi, whatsappContactsApi, whatsappApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import BulkEmailSheet from "@/components/BulkEmailDialog";
import EmailTemplates from "@/components/EmailTemplates";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormFieldAi } from "@/components/form/FormFieldAi";
import { whatsappPhoneFromLead, isWhatsappLead, formatWhatsappPhoneDisplay } from "@/lib/whatsappLead";

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
  opted_in_at: string | null; tags: string[]; created_at: string; lead_id?: string | null;
}

type WaMenuItem = {
  id?: string;
  title: string;
  description?: string;
  response: string;
  aiGenerate?: boolean;
};

const emptyMenuItem = (): WaMenuItem => ({ title: "", description: "", response: "" });

const LeadAgent = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'whatsapp' ? 'whatsapp' : 'leads';
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
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editLeadData, setEditLeadData] = useState<Partial<Lead>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  // WhatsApp state
  const [waContacts, setWaContacts] = useState<WhatsAppContact[]>([]);
  const [waPhone, setWaPhone] = useState("");
  const [waName, setWaName] = useState("");
  const [waLoading, setWaLoading] = useState(false);
  const [waConversations, setWaConversations] = useState<Array<{ phone: string; lastMessage: string; lastAt: string; inboundCount: number }>>([]);
  const [waReplyPhone, setWaReplyPhone] = useState("");
  const [waReplyLeadId, setWaReplyLeadId] = useState<string | null>(null);
  const [waReplyText, setWaReplyText] = useState("");
  const [waReplying, setWaReplying] = useState(false);
  const [waFlowEnabled, setWaFlowEnabled] = useState(false);
  const [waFlowServiceName, setWaFlowServiceName] = useState("MyService");
  const [waFlowWelcomeMessage, setWaFlowWelcomeMessage] = useState("");
  const [waFlowMenuItems, setWaFlowMenuItems] = useState<WaMenuItem[]>([emptyMenuItem()]);
  const [waFlowAiFallback, setWaFlowAiFallback] = useState(true);
  const [waFlowSaving, setWaFlowSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();

  useEffect(() => {
    if (!user || !tenant || !activeWorkspace) return;
    loadLeads();
    loadLeadSource();
  }, [user, tenant?.id, activeWorkspace, workspaceVersion]);
  useEffect(() => {
    if (tenant && activeWorkspace) {
      loadWaContacts();
      loadWaConversations();
      loadWaFlowConfig();
    }
  }, [tenant?.id, activeWorkspace, workspaceVersion]);

  const loadWaFlowConfig = async () => {
    if (!tenant || !activeWorkspace) return;
    try {
      const cfg = await whatsappApi.getFlowConfig(tenant.id, activeWorkspace);
      setWaFlowEnabled(Boolean(cfg.enabled));
      setWaFlowServiceName(cfg.serviceName || "MyService");
      setWaFlowWelcomeMessage(cfg.welcomeMessage || "");
      setWaFlowAiFallback(cfg.aiFallbackEnabled !== false);
      const items = Array.isArray(cfg.menuItems) ? cfg.menuItems : [];
      setWaFlowMenuItems(items.length ? items : [emptyMenuItem()]);
    } catch {
      setWaFlowEnabled(false);
      setWaFlowMenuItems([emptyMenuItem()]);
    }
  };

  const saveWaFlowConfig = async () => {
    if (!tenant || !activeWorkspace) return;

    const menuItems = waFlowMenuItems
      .map((item) => ({
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        response: item.aiGenerate ? item.response.trim() : item.response.trim(),
        aiGenerate: Boolean(item.aiGenerate),
      }))
      .filter((item) => item.title && (item.response || item.aiGenerate));

    if (waFlowEnabled && menuItems.length === 0) {
      toast({
        title: "Add at least one menu option",
        description: "Each option needs a label and either reply text or AI-generated reply enabled.",
        variant: "destructive",
      });
      return;
    }

    setWaFlowSaving(true);
    try {
      await whatsappApi.updateFlowConfig(tenant.id, {
        enabled: waFlowEnabled,
        serviceName: waFlowServiceName.trim() || "MyService",
        welcomeMessage: waFlowWelcomeMessage.trim() || undefined,
        aiFallbackEnabled: waFlowAiFallback,
        menuItems,
      }, activeWorkspace ?? undefined);
      toast({
        title: waFlowEnabled ? "Menu bot enabled" : "Menu bot disabled",
        description: waFlowEnabled
          ? `Customers message Hi to see ${menuItems.length} option(s).`
          : "WhatsApp menu bot turned off for this workspace.",
      });
      loadWaFlowConfig();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setWaFlowSaving(false);
    }
  };

  const updateWaMenuItem = (index: number, patch: Partial<WaMenuItem>) => {
    setWaFlowMenuItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeWaMenuItem = (index: number) => {
    setWaFlowMenuItems((prev) => (prev.length <= 1 ? [emptyMenuItem()] : prev.filter((_, i) => i !== index)));
  };

  const loadWaConversations = async () => {
    if (!tenant || !activeWorkspace) return;
    try {
      const rows = await whatsappApi.conversations(tenant.id, activeWorkspace);
      setWaConversations(Array.isArray(rows) ? rows : []);
    } catch {
      setWaConversations([]);
    }
  };

  const sendWaReply = async () => {
    if (!tenant || !waReplyPhone.trim() || !waReplyText.trim()) return;
    setWaReplying(true);
    try {
      const res = await whatsappApi.reply({
        tenantId: tenant.id,
        phone: waReplyPhone.trim(),
        message: waReplyText.trim(),
        leadId: waReplyLeadId ?? undefined,
      });
      if (!res.sent) throw new Error(res.message ?? "Send failed");
      toast({ title: "WhatsApp reply sent" });
      setWaReplyText("");
      loadWaConversations();
    } catch (err: unknown) {
      toast({
        title: "Reply failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setWaReplying(false);
    }
  };

  const messageWhatsAppLead = (lead: Lead) => {
    const phone = whatsappPhoneFromLead(lead);
    if (!phone) {
      toast({
        title: "No WhatsApp number",
        description: "This lead was not created from WhatsApp.",
        variant: "destructive",
      });
      return;
    }
    setActiveTab("whatsapp");
    setWaReplyPhone(phone);
    setWaReplyLeadId(lead.id);
    setWaReplyText(lead.ai_reply || "");
    toast({
      title: "Ready to message lead",
      description: `Reply will go to ${formatWhatsappPhoneDisplay(phone)} from your connected WhatsApp Business number.`,
    });
  };

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
    if (!tenant || !activeWorkspace) return;
    try {
      const list = await whatsappContactsApi.findAll(tenant.id, activeWorkspace);
      setWaContacts(
        (Array.isArray(list) ? list : []).map((c: Record<string, unknown>) => ({
            id: String(c.id),
            phone: String(c.phone),
            name: c.name != null ? String(c.name) : null,
            opted_in: Boolean(c.optedIn),
            opted_in_at: c.optedInAt != null ? String(c.optedInAt) : null,
            tags: (c.tags as string[]) ?? [],
            created_at: String(c.created_at ?? ""),
            lead_id: c.leadId != null ? String(c.leadId) : null,
          })),
      );
    if (activeTab === 'leads') void loadLeads();
    } catch {
      setWaContacts([]);
    }
  };

  const addWaContact = async () => {
    if (!waPhone.trim() || !tenant || !activeWorkspace) return;
    setWaLoading(true);
    try {
      await whatsappContactsApi.create({
        tenantId: tenant.id,
        workspaceId: activeWorkspace,
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
    if (!tenant || !activeWorkspace) return;
    await whatsappContactsApi.update(id, tenant.id, {
      optedIn: !current,
      optedInAt: !current ? new Date().toISOString() : null,
    } as any, activeWorkspace);
    setWaContacts(prev => prev.map(c => c.id === id ? { ...c, opted_in: !current } : c));
  };

  const deleteWaContact = async (id: string) => {
    if (!tenant || !activeWorkspace) return;
    await whatsappContactsApi.remove(id, tenant.id, activeWorkspace);
    setWaContacts(prev => prev.filter(c => c.id !== id));
    toast({ title: "Contact removed" });
  };

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant || !activeWorkspace) return;
    const text = await file.text();
    const lines = text.split("\n").slice(1).filter(Boolean);
    let imported = 0;
    for (const line of lines) {
      const [phone, name] = line.split(",").map(s => s.replace(/^"|"$/g, "").trim());
      if (!phone) continue;
      try {
        await whatsappContactsApi.create({
          tenantId: tenant.id,
          workspaceId: activeWorkspace,
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
    if (!user || !tenant || !activeWorkspace) return;
    try {
      const all = await leadsApi.findAll(tenant.id, activeWorkspace);
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
        body: {
          leadId: lead.id,
          to: lead.email,
          subject: emailSubject,
          htmlBody: emailBody,
        },
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

  const handleEditLead = async () => {
    if (!selectedLead || !editLeadData.name || !editLeadData.email) {
      toast({ title: "Missing fields", description: "Name and email are required", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      await leadsApi.update(selectedLead.id, editLeadData as any);
      toast({ title: "Lead updated", description: "Changes saved successfully" });
      setEditSheetOpen(false);
      loadLeads();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message || "Could not update lead", variant: "destructive" });
    }
    setSavingEdit(false);
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
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-strong text-foreground">
          <MessageSquare className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Leads</h1>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            className={filterClass === f ? "" : ""}>
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
                      setEditLeadData({
                        name: lead.name,
                        email: lead.email,
                        status: lead.status,
                        classification: lead.classification,
                      });
                      setEditSheetOpen(true);
                    }}
                  >
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
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
                  {isWhatsappLead(lead) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-green-700 border-green-200"
                      onClick={() => messageWhatsAppLead(lead)}
                    >
                      <Phone className="h-3 w-3 mr-1" /> WhatsApp
                    </Button>
                  )}
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
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                How messaging works
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>
                  When a customer messages your <strong>connected WhatsApp Business number</strong>, they become a lead
                  (email like <code className="text-[10px]">wa+260…@inbox.mako</code>).
                </li>
                <li>
                  You do <strong>not</strong> send messages as the lead — you reply <strong>to their phone</strong> from
                  your business number (Leads → WhatsApp tab, or the WhatsApp button on a lead).
                </li>
                <li>
                  Replies must be within Meta&apos;s 24-hour session window after their last message (unless using approved templates).
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/50 border-green-200/50 bg-green-50/30 dark:bg-green-950/10">
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-green-600" />
                  WhatsApp menu bot
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Build your own menu — customers tap an option or reply with a number (1, 2, 3…).
                  They must message <strong>Hi</strong>, <strong>Hello</strong>, or <strong>menu</strong> to start.
                  Enable AI per option or for unmatched free-text messages.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/80 p-3">
                <div>
                  <Label htmlFor="wa-flow-enabled" className="text-sm font-medium">Enable for this workspace</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Turn on only after WhatsApp is connected and you have added menu options below.
                  </p>
                </div>
                <Switch id="wa-flow-enabled" checked={waFlowEnabled} onCheckedChange={setWaFlowEnabled} />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/80 p-3">
                <div>
                  <Label htmlFor="wa-flow-ai-fallback" className="text-sm font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI for free-text messages
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    When a customer sends text that doesn&apos;t match the menu, AI replies using your Brand Brain context.
                  </p>
                </div>
                <Switch id="wa-flow-ai-fallback" checked={waFlowAiFallback} onCheckedChange={setWaFlowAiFallback} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Business / service name</Label>
                <FormFieldAi
                  form="whatsapp-menu"
                  tenantId={tenant?.id}
                  fieldKey="serviceName"
                  type="input"
                  value={waFlowServiceName}
                  onChange={setWaFlowServiceName}
                  placeholder="e.g. Acme Shop"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown in the welcome line: &quot;Welcome to <strong>{waFlowServiceName || "Your Business"}</strong>&quot;
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Custom welcome message (optional)</Label>
                <FormFieldAi
                  form="whatsapp-menu"
                  tenantId={tenant?.id}
                  fieldKey="welcomeMessage"
                  type="input"
                  value={waFlowWelcomeMessage}
                  onChange={setWaFlowWelcomeMessage}
                  placeholder="Welcome to {serviceName}! How can we help?"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank for the default welcome. Use <code className="text-[10px]">{'{serviceName}'}</code> as a placeholder.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Menu options (what customers can choose)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={waFlowMenuItems.length >= 10}
                    onClick={() => setWaFlowMenuItems((prev) => [...prev, emptyMenuItem()])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add option
                  </Button>
                </div>

                {waFlowMenuItems.map((item, index) => (
                  <div key={index} className="rounded-lg border border-border/60 p-3 space-y-2 bg-background/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Option {index + 1}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        onClick={() => removeWaMenuItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <FormFieldAi
                      form="whatsapp-menu"
                      tenantId={tenant?.id}
                      fieldKey="menuTitle"
                      type="input"
                      value={item.title}
                      onChange={(value) => updateWaMenuItem(index, { title: value })}
                      placeholder="Menu label — e.g. Pricing, Book a demo, Support"
                      className="h-9"
                    />
                    <FormFieldAi
                      form="whatsapp-menu"
                      tenantId={tenant?.id}
                      fieldKey="menuDescription"
                      type="input"
                      value={item.description ?? ""}
                      onChange={(value) => updateWaMenuItem(index, { description: value })}
                      placeholder="Short hint (optional) — shown under the label in the list"
                      className="h-9"
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`wa-menu-ai-${index}`}
                        checked={Boolean(item.aiGenerate)}
                        onCheckedChange={(checked) =>
                          updateWaMenuItem(index, { aiGenerate: checked === true })
                        }
                      />
                      <Label htmlFor={`wa-menu-ai-${index}`} className="text-xs font-normal cursor-pointer flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        AI writes the reply (use guidance below)
                      </Label>
                    </div>
                    <FormFieldAi
                      form="whatsapp-menu"
                      tenantId={tenant?.id}
                      fieldKey="menuResponse"
                      type="textarea"
                      value={item.response}
                      onChange={(value) => updateWaMenuItem(index, { response: value })}
                      placeholder={
                        item.aiGenerate
                          ? "Guidance for AI — e.g. share pricing tiers and link to book a call"
                          : "Reply when selected — what the customer receives on WhatsApp"
                      }
                      rows={3}
                    />
                  </div>
                ))}
              </div>

              <Button size="sm" onClick={saveWaFlowConfig} disabled={waFlowSaving} className="w-full sm:w-auto">
                {waFlowSaving ? "Saving…" : "Save menu bot"}
              </Button>
            </CardContent>
          </Card>

          {/* Add contact */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="font-medium text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-green-500"/>Add WhatsApp Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
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

          {/* Reply to leads / conversations */}
          <Card className="border-border/50 border-green-200/50">
            <CardContent className="p-4 space-y-3">
              <p className="font-medium text-sm flex items-center gap-2">
                <Send className="h-4 w-4 text-green-600" />
                Send message to a lead
              </p>
              <p className="text-xs text-muted-foreground">
                Messages go <strong>from your WhatsApp Business number</strong> to the customer&apos;s phone — not from the lead.
                Pick a recent conversation or enter their number (from a WhatsApp lead card, use the WhatsApp button).
              </p>
              {waConversations.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground">Recent conversations</p>
                  {waConversations.slice(0, 8).map((c) => (
                    <button
                      key={c.phone}
                      type="button"
                      className={`w-full text-left rounded-md border p-2 text-sm hover:bg-muted/50 ${waReplyPhone === c.phone ? "border-primary" : ""}`}
                      onClick={() => {
                        setWaReplyPhone(c.phone);
                        setWaReplyLeadId(null);
                      }}
                    >
                      <span className="font-medium">{formatWhatsappPhoneDisplay(c.phone)}</span>
                      <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-2">
                <Input
                  placeholder="Customer phone (digits only, e.g. 260971234567)"
                  value={waReplyPhone}
                  onChange={(e) => {
                    setWaReplyPhone(e.target.value.replace(/\D/g, ""));
                    setWaReplyLeadId(null);
                  }}
                />
                <Textarea
                  placeholder="Your reply (within 24h of their last message)…"
                  value={waReplyText}
                  onChange={(e) => setWaReplyText(e.target.value)}
                  rows={3}
                />
                <Button size="sm" onClick={sendWaReply} disabled={waReplying || !waReplyPhone.trim() || !waReplyText.trim()}>
                  {waReplying ? "Sending…" : "Send to customer"}
                </Button>
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
                      {c.lead_id && (
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline mt-0.5"
                          onClick={() => {
                            setActiveTab('leads');
                            const lead = leads.find((l) => l.id === c.lead_id);
                            if (lead) setSelectedLead(lead);
                          }}
                        >
                          Linked lead — view in Leads tab
                        </button>
                      )}
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
              className="w-full"
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
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" /> {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Edit Lead</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editLeadData.name || ""}
                onChange={(e) => setEditLeadData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Lead name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={editLeadData.email || ""}
                onChange={(e) => setEditLeadData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Lead email"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Classification</Label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={editLeadData.classification || "cold"}
                onChange={(e) => setEditLeadData((prev) => ({ ...prev, classification: e.target.value }))}
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={editLeadData.status || "new"}
                onChange={(e) => setEditLeadData((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="new">New</option>
                <option value="qualifying">Qualifying</option>
                <option value="qualified">Qualified</option>
                <option value="meeting_booked">Meeting Booked</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
            <Button
              onClick={handleEditLead}
              disabled={savingEdit}
              className="w-full mt-2"
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LeadAgent;
