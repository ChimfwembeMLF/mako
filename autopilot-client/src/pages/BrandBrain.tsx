import { useState, useEffect } from "react";
import { Brain, Building2, Users, Megaphone, MessageCircle, ShieldCheck, Save, Globe, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { brandProfilesApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import RichTextEditor from "@/components/RichTextEditor";
import { ScrapeBrandBrain } from "@/components/ScrapeBrandBrain";
import { DocumentUpload } from "@/components/DocumentUpload";

interface BrandData {
  companyName: string;
  industry: string;
  description: string;
  services: string;
  targetAudience: string;
  audiencePainPoints: string;
  toneOfVoice: string;
  brandPersonality: string;
  currentOffers: string;
  uniqueSellingPoints: string;
  faqs: string;
  caseStudies: string;
  bannedWords: string;
  bannedTopics: string;
  competitors: string;
  keywords: string;
  websiteUrl: string;
}

const initialData: BrandData = {
  companyName: "", industry: "", description: "", services: "",
  targetAudience: "", audiencePainPoints: "", toneOfVoice: "", brandPersonality: "",
  currentOffers: "", uniqueSellingPoints: "", faqs: "", caseStudies: "",
  bannedWords: "", bannedTopics: "", competitors: "", keywords: "",
  websiteUrl: "",
};

const fromApi = (row: Record<string, unknown>): BrandData => ({
  companyName: String(row.companyName ?? ""),
  industry: String(row.industry ?? ""),
  description: String(row.description ?? ""),
  services: String(row.services ?? ""),
  targetAudience: String(row.targetAudience ?? ""),
  audiencePainPoints: String(row.audiencePainPoints ?? ""),
  toneOfVoice: String(row.toneOfVoice ?? ""),
  brandPersonality: String(row.brandPersonality ?? ""),
  currentOffers: String(row.currentOffers ?? ""),
  uniqueSellingPoints: String(row.uniqueSellingPoints ?? ""),
  faqs: String(row.faqs ?? ""),
  caseStudies: String(row.caseStudies ?? ""),
  bannedWords: String(row.bannedWords ?? ""),
  bannedTopics: String(row.bannedTopics ?? ""),
  competitors: String(row.competitors ?? ""),
  keywords: String(row.keywords ?? ""),
  websiteUrl: String(row.websiteUrl ?? ""),
});

const toApi = (d: BrandData) => ({
  companyName: d.companyName,
  industry: d.industry,
  description: d.description,
  services: d.services,
  targetAudience: d.targetAudience,
  audiencePainPoints: d.audiencePainPoints,
  toneOfVoice: d.toneOfVoice,
  brandPersonality: d.brandPersonality,
  currentOffers: d.currentOffers,
  uniqueSellingPoints: d.uniqueSellingPoints,
  faqs: d.faqs,
  caseStudies: d.caseStudies,
  bannedWords: d.bannedWords,
  bannedTopics: d.bannedTopics,
  competitors: d.competitors,
  keywords: d.keywords,
  websiteUrl: d.websiteUrl,
});

const sections = [
  {
    id: "company", label: "Company", icon: Building2,
    fields: [
      { key: "companyName", label: "Company Name", type: "input", placeholder: "Acme Inc." },
      { key: "industry", label: "Industry", type: "input", placeholder: "SaaS, E-commerce, Real Estate..." },
      { key: "description", label: "Company Description", type: "textarea", placeholder: "What does your company do?" },
      { key: "services", label: "Products & Services", type: "textarea", placeholder: "List your main products/services" },
      { key: "uniqueSellingPoints", label: "Unique Selling Points", type: "textarea", placeholder: "What makes you different?" },
    ],
  },
  {
    id: "audience", label: "Audience", icon: Users,
    fields: [
      { key: "targetAudience", label: "Target Audience", type: "textarea", placeholder: "Demographics, job titles, interests..." },
      { key: "audiencePainPoints", label: "Pain Points", type: "textarea", placeholder: "What problems does your audience face?" },
      { key: "competitors", label: "Competitors", type: "textarea", placeholder: "Who are your main competitors?" },
    ],
  },
  {
    id: "voice", label: "Voice & Tone", icon: Megaphone,
    fields: [
      { key: "toneOfVoice", label: "Tone of Voice", type: "textarea", placeholder: "Professional, casual, witty..." },
      { key: "brandPersonality", label: "Brand Personality", type: "textarea", placeholder: "If your brand were a person..." },
      { key: "keywords", label: "Key Phrases & Keywords", type: "textarea", placeholder: "Phrases you want to use often" },
    ],
  },
  {
    id: "offers", label: "Offers & CTAs", icon: MessageCircle,
    fields: [
      { key: "currentOffers", label: "Current Offers", type: "textarea", placeholder: "Active promotions, deals..." },
      { key: "faqs", label: "FAQs", type: "textarea", placeholder: "Common questions and answers" },
      { key: "caseStudies", label: "Case Studies", type: "textarea", placeholder: "Success stories, client wins..." },
    ],
  },
  {
    id: "guardrails", label: "Guardrails", icon: ShieldCheck,
    fields: [
      { key: "bannedWords", label: "Banned Words", type: "textarea", placeholder: "Words the AI should never use" },
      { key: "bannedTopics", label: "Banned Topics", type: "textarea", placeholder: "Topics to avoid in all content" },
    ],
  },
];

const BrandBrain = () => {
  const [data, setData] = useState<BrandData>(initialData);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !tenant) return;
    const load = async () => {
      try {
        const all = await brandProfilesApi.findAll();
        const list = Array.isArray(all) ? all : [];
        const row = list.find(
          (p: Record<string, unknown>) =>
            p.tenantId === tenant.id && p.userId === user.id,
        );
        if (row) {
          setProfileId(String(row.id));
          const d = fromApi(row);
          setData(d);
          if (d.websiteUrl) setScrapeUrl(d.websiteUrl);
        }
      } catch {
        /* empty profile */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, tenant]);

  const updateField = (key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const completionPercent = Math.round(
    (Object.values(data).filter((v) => v.trim().length > 0).length / Object.keys(data).length) * 100
  );

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    try {
      const { data: result, error } = await invokeEdgeFunction("scrape-brand", {
        body: { url: scrapeUrl.trim() },
      });
      if (error) throw error;
      if (!result || typeof result !== 'object') throw new Error("Scraping failed");

      // Normalise: arrays → comma-separated strings
      const normalise = (v: unknown, _key: string): string => {
        if (Array.isArray(v)) return v.join(", ");
        if (typeof v === "string") return v;
        return "";
      };

      const scraped = result as Record<string, unknown>;
      setData((prev) => {
        const updated = { ...prev, websiteUrl: scrapeUrl.trim() };
        for (const key of Object.keys(scraped) as (keyof BrandData)[]) {
          const val = normalise(scraped[key], key);
          if (val.trim().length > 0) updated[key] = val;
        }
        return updated;
      });
      toast({ title: "Auto-fill complete", description: "Brand Brain populated from your website. Review and save!" });
    } catch (error: any) {
      toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    if (!user || !tenant) return;
    setSaving(true);
    try {
      const payload = {
        tenantId: tenant.id,
        userId: user.id,
        ...toApi(data),
      };
      if (profileId) {
        await brandProfilesApi.update(profileId, payload);
      } else {
        const created = await brandProfilesApi.create(payload);
        setProfileId(String(created.id));
      }
      toast({ title: "Brand Brain saved", description: "Your brand profile has been updated." });
    } catch (error: any) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Loading your Brand Brain...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Brand Brain</h1>
            <p className="text-muted-foreground text-sm">Everything the AI needs to represent your brand accurately.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving..." : "Save Brand Brain"}
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Profile completion</span>
            <span className="text-sm font-bold text-primary">{completionPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${completionPercent}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Auto-fill from Website</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://yourcompany.com"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              disabled={scraping}
            />
            <Button onClick={handleScrape} disabled={scraping || !scrapeUrl.trim()} variant="outline" className="shrink-0">
              {scraping ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning...</> : "Auto-fill"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Paste your website URL to auto-populate all fields using AI.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="company">
        <TabsList className="w-full justify-start overflow-x-auto bg-card border">
          {sections.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} className="mt-4 space-y-4">
            {section.fields.map((field) => (
              <Card key={field.key} className="border-border/50">
                <CardContent className="p-4 space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.type === "input" ? (
                    <Input id={field.key} placeholder={field.placeholder} value={(data as any)[field.key]} onChange={(e) => updateField(field.key, e.target.value)} />
                  ) : (
                    <RichTextEditor
                      value={(data as any)[field.key]}
                      onChange={(val) => updateField(field.key, val)}
                      placeholder={field.placeholder}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-end pt-2 pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving..." : "Save Brand Brain"}
        </Button>
      </div>
    </div>
  );
};

export default BrandBrain;