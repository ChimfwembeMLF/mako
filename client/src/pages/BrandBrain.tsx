import { useState, useEffect, useMemo } from "react";
import { Brain, Building2, Users, Megaphone, MessageCircle, ShieldCheck, Save, Globe, Loader2, FileText, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useFormSuggestions } from "@/hooks/useFormSuggestions";
import { SuggestedField } from "@/components/form/SuggestedField";
import { brandProfilesApi } from "@/lib/api";
import { DocumentUpload } from "@/components/DocumentUpload";

interface BrandData {
  brandType: string;
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

type FieldDef = {
  key: keyof BrandData;
  label: string;
  type: "input" | "textarea";
  placeholder?: string;
  rows?: number;
};

const BRAND_FIELD_KEYS: (keyof BrandData)[] = [
  "brandType", "companyName", "industry", "description", "services", "targetAudience",
  "audiencePainPoints", "toneOfVoice", "brandPersonality", "currentOffers",
  "uniqueSellingPoints", "faqs", "caseStudies", "bannedWords", "bannedTopics",
  "competitors", "keywords",
];

function coerceScrapedValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(coerceScrapedValue).filter(Boolean).join("\n");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const inner = coerceScrapedValue(val);
        return inner ? `${k}: ${inner}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(v);
}

function applyScrapedResult(prev: BrandData, scraped: Record<string, unknown>, fallbackUrl: string): BrandData {
  const updated = { ...prev, websiteUrl: String(scraped.websiteUrl ?? fallbackUrl).trim() };
  for (const key of BRAND_FIELD_KEYS) {
    const val = coerceScrapedValue(scraped[key]);
    if (val) {
      updated[key] = val;
    }
  }
  return updated;
}

const initialData: BrandData = {
  brandType: "business", companyName: "", industry: "", description: "", services: "",
  targetAudience: "", audiencePainPoints: "", toneOfVoice: "", brandPersonality: "",
  currentOffers: "", uniqueSellingPoints: "", faqs: "", caseStudies: "",
  bannedWords: "", bannedTopics: "", competitors: "", keywords: "",
  websiteUrl: "",
};

const fromApi = (row: Record<string, unknown>): BrandData => ({
  brandType: String(row.brandType || "business"),
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
  brandType: d.brandType,
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

const sections: Array<{ id: string; label: string; icon: typeof Building2; fields: FieldDef[] }> = [
  {
    id: "company", label: "Company", icon: Building2,
    fields: [
      { key: "companyName", label: "Company Name", type: "input", placeholder: "Acme Inc." },
      { key: "industry", label: "Industry", type: "input", placeholder: "SaaS, E-commerce, Real Estate..." },
      { key: "description", label: "Company Description", type: "textarea", placeholder: "What does your company do?", rows: 5 },
      { key: "services", label: "Products & Services", type: "textarea", placeholder: "List your main products and services", rows: 4 },
      { key: "uniqueSellingPoints", label: "Unique Selling Points", type: "textarea", placeholder: "What makes you different?", rows: 4 },
    ],
  },
  {
    id: "audience", label: "Audience", icon: Users,
    fields: [
      { key: "targetAudience", label: "Target Audience", type: "textarea", placeholder: "Demographics, job titles, interests...", rows: 4 },
      { key: "audiencePainPoints", label: "Pain Points", type: "textarea", placeholder: "What problems does your audience face?", rows: 4 },
      { key: "competitors", label: "Competitors", type: "textarea", placeholder: "Who are your main competitors?", rows: 4 },
    ],
  },
  {
    id: "voice", label: "Voice & Tone", icon: Megaphone,
    fields: [
      { key: "toneOfVoice", label: "Tone of Voice", type: "textarea", placeholder: "Professional, casual, witty...", rows: 3 },
      { key: "brandPersonality", label: "Brand Personality", type: "textarea", placeholder: "If your brand were a person...", rows: 3 },
      { key: "keywords", label: "Key Phrases & Keywords", type: "textarea", placeholder: "Phrases you want to use often", rows: 3 },
    ],
  },
  {
    id: "offers", label: "Offers & CTAs", icon: MessageCircle,
    fields: [
      { key: "currentOffers", label: "Current Offers", type: "textarea", placeholder: "Active promotions, deals...", rows: 3 },
      { key: "faqs", label: "FAQs", type: "textarea", placeholder: "Common questions and answers", rows: 5 },
      { key: "caseStudies", label: "Case Studies", type: "textarea", placeholder: "Success stories, client wins...", rows: 5 },
    ],
  },
  {
    id: "guardrails", label: "Guardrails", icon: ShieldCheck,
    fields: [
      { key: "bannedWords", label: "Banned Words", type: "textarea", placeholder: "Words the AI should never use", rows: 3 },
      { key: "bannedTopics", label: "Banned Topics", type: "textarea", placeholder: "Topics to avoid in all content", rows: 3 },
    ],
  },
];

const BrandBrainInner = () => {
  const [data, setData] = useState<BrandData>(initialData);
  const [activeTab, setActiveTab] = useState("company");
  const [saving, setSaving] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { activeWorkspace, workspaces, workspaceVersion, loading: workspaceLoading } = useWorkspace();
  const activeWorkspaceName = workspaces.find((w: { id: string }) => w.id === activeWorkspace)?.name;

  const [loading, setLoading] = useState(true);

  const visibleFieldKeys = useMemo(
    () =>
      sections
        .find((s) => s.id === activeTab)
        ?.fields.filter((f) => f.key !== "websiteUrl")
        .map((f) => f.key) ?? [],
    [activeTab],
  );

  const suggestionValues = useMemo(
    () =>
      Object.fromEntries(
        visibleFieldKeys.map((key) => [key, data[key as keyof BrandData] ?? ""]),
      ),
    [visibleFieldKeys, data],
  );

  const { getPlaceholder, getSuggestionsForField, getSelectedIndex, setFieldIndex, pauseField, isFieldActive, fetchSuggestions } = useFormSuggestions({
    form: "brand-brain",
    tenantId: tenant?.id,
    fieldKeys: visibleFieldKeys,
    values: suggestionValues,
    enabled: !loading && !tenantLoading,
  });

  useEffect(() => {
    if (!user || !tenant || workspaceLoading) return;
    if (workspaces.length > 0 && !activeWorkspace) return;

    const workspaceId = activeWorkspace ?? undefined;
    let cancelled = false;

    setData(initialData);
    setScrapeUrl('');
    setLoading(true);

    const load = async () => {
      try {
        const row = await brandProfilesApi.getMine(tenant.id, workspaceId);
        if (cancelled) return;
        if (workspaceId && row?.id && String(row.workspaceId ?? "") !== workspaceId) {
          return;
        }
        if (row?.id) {
          const d = fromApi(row as Record<string, unknown>);
          setData(d);
          if (d.websiteUrl) setScrapeUrl(d.websiteUrl);
        }
      } catch {
        /* empty profile */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [user, tenant, activeWorkspace, workspaceVersion, workspaceLoading, workspaces.length]);

  const updateField = (key: keyof BrandData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const completionPercent = Math.round(
    (Object.values(data).filter((v) => v.trim().length > 0).length / Object.keys(data).length) * 100
  );

  const handleParsedDocument = (parsed: Record<string, string>) => {
    setData((prev) => applyScrapedResult(prev, parsed, prev.websiteUrl));
    const filledCount = BRAND_FIELD_KEYS.filter((k) => coerceScrapedValue(parsed[k])).length;
    toast({
      title: "Auto-fill complete",
      description: filledCount
        ? `Populated ${filledCount} field${filledCount === 1 ? "" : "s"} from your document. Review and save.`
        : "No fields could be extracted — try a different file or fill in manually.",
      variant: filledCount ? "default" : "destructive",
    });
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim() || !tenant) return;
    setScraping(true);
    try {
      const result = await brandProfilesApi.scrapeWebsite({
        url: scrapeUrl.trim(),
        tenantId: tenant.id,
      });
      if (!result || typeof result !== "object") throw new Error("Scraping failed");

      const scraped = result as Record<string, unknown>;
      setData((prev) => applyScrapedResult(prev, scraped, scrapeUrl.trim()));

      const filledCount = BRAND_FIELD_KEYS.filter((k) => coerceScrapedValue(scraped[k])).length;
      toast({
        title: "Auto-fill complete",
        description: filledCount
          ? `Populated ${filledCount} field${filledCount === 1 ? "" : "s"} from your website. Review and save.`
          : "No fields could be extracted — try a different URL or fill in manually.",
        variant: filledCount ? "default" : "destructive",
      });
    } catch (error: unknown) {
      toast({
        title: "Scrape failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    if (!user || !tenant) return;
    if (workspaces.length > 0 && !activeWorkspace) {
      toast({
        title: "No workspace selected",
        description: "Choose a workspace in the top navbar before saving Brand Brain.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await brandProfilesApi.save({
        tenantId: tenant.id,
        workspaceId: activeWorkspace ?? undefined,
        ...toApi(data),
      });
      toast({ title: "Brand Brain saved", description: "Your brand profile has been updated." });
    } catch (error: unknown) {
      toast({
        title: "Error saving",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || tenantLoading || workspaceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Loading your Brand Brain...</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Brand Brain</h1>
            <p className="text-muted-foreground text-sm">
              {activeWorkspaceName
                ? `Brand profile for “${activeWorkspaceName}”. Switch workspace in the top navbar.`
                : 'Create a workspace to set up Brand Brain.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => fetchSuggestions()}>
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            Get AI Suggestions
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Brand Brain"}
          </Button>
        </div>
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

      <div className="grid gap-4 md:grid-cols-2">
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
            <p className="text-xs text-muted-foreground mt-2">Paste your website URL to auto-populate fields using AI.</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Auto-fill from Document</span>
            </div>
            <DocumentUpload
              onResult={handleParsedDocument}
              disabled={scraping}
              workspaceId={activeWorkspace}
            />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            {section.id === 'company' && (
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-2">
                  <Label htmlFor="brandType">Brand Profile Type</Label>
                  <Select
                    value={data.brandType}
                    onValueChange={(val) => updateField('brandType', val)}
                  >
                    <SelectTrigger id="brandType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business / Agency</SelectItem>
                      <SelectItem value="product">Product / App</SelectItem>
                      <SelectItem value="professional_resume">Professional / Resume / Creator</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">This helps our AI generate the right tone for your profile.</p>
                </CardContent>
              </Card>
            )}
            {section.fields.map((field) => (
              <Card key={field.key} className="border-border/50">
                <CardContent className="p-4 space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <SuggestedField
                    id={field.key}
                    type={field.type}
                    value={data[field.key]}
                    onChange={(value) => updateField(field.key, value)}
                    fallbackPlaceholder={field.placeholder}
                    placeholder={getPlaceholder(field.key, field.placeholder ?? "")}
                    suggestions={getSuggestionsForField(field.key)}
                    selectedIndex={getSelectedIndex(field.key)}
                    onSelectIndex={(index) => setFieldIndex(field.key, index)}
                    onPauseRotation={() => pauseField(field.key)}
                    isLive={isFieldActive(field.key)}
                    rows={field.rows ?? 4}
                  />
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

export default function BrandBrain() {
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  return (
    <BrandBrainInner key={`${activeWorkspace ?? "none"}-${workspaceVersion}`} />
  );
}
