import { useState, useEffect, useMemo } from "react";
import { Brain, Building2, Users, Megaphone, MessageCircle, ShieldCheck, Save, Globe, Loader2, FileText, HelpCircle, CheckCircle2, Sparkles, ChevronDown, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FormFieldAi } from "@/components/form/FormFieldAi";
import { brandProfilesApi } from "@/lib/api";
import { DocumentUpload } from "@/components/DocumentUpload";
import { TourService } from "@/services/tour.service";
import { brandBrainTourConfig } from "./BrandBrain.tour";
import { cn } from "@/lib/utils";

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

type Section = { id: string; label: string; icon: typeof Building2; intro: string; fields: FieldDef[] };

const sections: Section[] = [
  {
    id: "company", label: "Company", icon: Building2,
    intro: "What you do and why people choose you. Mako draws on this for every post.",
    fields: [
      { key: "companyName", label: "Company name", type: "input", placeholder: "Acme Inc." },
      { key: "industry", label: "Industry", type: "input", placeholder: "Coffee roasting, real estate, SaaS…" },
      { key: "description", label: "What you do", type: "textarea", placeholder: "A few sentences about your business", rows: 4 },
      { key: "services", label: "Products and services", type: "textarea", placeholder: "Your main products and services", rows: 4 },
      { key: "uniqueSellingPoints", label: "What makes you different", type: "textarea", placeholder: "Why customers pick you over others", rows: 3 },
    ],
  },
  {
    id: "audience", label: "Audience", icon: Users,
    intro: "Who you are talking to and what they struggle with, so posts speak to real needs.",
    fields: [
      { key: "targetAudience", label: "Who you are for", type: "textarea", placeholder: "Ages, roles, places, interests…", rows: 4 },
      { key: "audiencePainPoints", label: "Their problems", type: "textarea", placeholder: "What problems does your audience face?", rows: 4 },
      { key: "competitors", label: "Competitors", type: "textarea", placeholder: "Who else they might buy from", rows: 3 },
    ],
  },
  {
    id: "voice", label: "Voice & tone", icon: Megaphone,
    intro: "How you sound. This shapes word choice, length and style in everything Mako writes.",
    fields: [
      { key: "toneOfVoice", label: "Tone of voice", type: "textarea", placeholder: "Warm and plain-spoken, never pushy…", rows: 3 },
      { key: "brandPersonality", label: "Personality", type: "textarea", placeholder: "If your brand were a person…", rows: 3 },
      { key: "keywords", label: "Phrases to use", type: "textarea", placeholder: "Words and phrases you want to use often", rows: 3 },
    ],
  },
  {
    id: "offers", label: "Offers & proof", icon: MessageCircle,
    intro: "What you want people to do next, the questions they ask, and proof that you deliver.",
    fields: [
      { key: "currentOffers", label: "Current offers", type: "textarea", placeholder: "Promotions, deals, launches…", rows: 3 },
      { key: "faqs", label: "Questions customers ask", type: "textarea", placeholder: "Common questions and your answers", rows: 4 },
      { key: "caseStudies", label: "Success stories", type: "textarea", placeholder: "Client wins, reviews, results…", rows: 4 },
    ],
  },
  {
    id: "guardrails", label: "Guardrails", icon: ShieldCheck,
    intro: "What Mako must never say. These rules apply to every post and reply.",
    fields: [
      { key: "bannedWords", label: "Words to avoid", type: "textarea", placeholder: "One per line or separated by commas", rows: 3 },
      { key: "bannedTopics", label: "Topics to avoid", type: "textarea", placeholder: "Subjects to stay away from", rows: 3 },
    ],
  },
];

const BRAND_TYPES = [
  { value: "business", label: "Business or agency", hint: "Sells products or services" },
  { value: "product", label: "Product or app", hint: "Promotes one product" },
  { value: "professional_resume", label: "Person or creator", hint: "Builds a personal brand" },
];

/** The fields that count towards completion (brand type always has a value). */
const ANSWERABLE = sections.flatMap((sec) => sec.fields.map((f) => f.key));
const filled = (d: BrandData, key: keyof BrandData) => d[key].trim().length > 0;

function ProgressRing({ percent }: { percent: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="26" cy="26" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <Brain className="h-5 w-5 text-primary" />
      </span>
    </div>
  );
}

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
  /** What is saved on the server, to tell whether there are unsaved edits. */
  const [savedData, setSavedData] = useState<BrandData | null>(null);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        TourService.autoStartTour('brand_brain', brandBrainTourConfig.steps, undefined, brandBrainTourConfig.driverConfig);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

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
          setSavedData(d);
          if (d.websiteUrl) setScrapeUrl(d.websiteUrl);
        } else {
          setSavedData(initialData);
        }
      } catch {
        /* empty profile */
        if (!cancelled) setSavedData(initialData);
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

  const answered = ANSWERABLE.filter((k) => filled(data, k)).length;
  const completionPercent = Math.round((answered / ANSWERABLE.length) * 100);
  const dirty = savedData !== null && JSON.stringify(data) !== JSON.stringify(savedData);
  const [autofillOpen, setAutofillOpen] = useState(false);

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
        description: "Choose a workspace in the sidebar before saving Brand voice.",
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
      setSavedData(data);
      toast({ title: "Brand voice saved", description: "Mako will write in this voice from now on." });
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

  // Warn before closing the tab with unsaved edits, and save with Ctrl/⌘+S.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading || tenantLoading || workspaceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Loading your Brand voice...</div>
      </div>
    );
  }

  const sectionIndex = Math.max(0, sections.findIndex((x) => x.id === activeTab));
  const section = sections[sectionIndex];
  const nextSection = sections[sectionIndex + 1];
  const countFor = (sec: Section) => sec.fields.filter((f) => filled(data, f.key)).length;
  const showAutofill = autofillOpen || completionPercent < 50;

  const saveButton = (extra?: string) => (
    <Button onClick={() => void handleSave()} disabled={saving || !dirty} className={cn("gap-2", extra)}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {saving ? "Saving…" : "Save"}
    </Button>
  );

  return (
    <div className="w-full min-w-0 space-y-6 pb-24 lg:pb-10">
      <div id="tour-bb-header" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ProgressRing percent={completionPercent} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Brand voice</h1>
            <p className="text-sm text-muted-foreground">
              {activeWorkspaceName ? (
                <>
                  How Mako writes for <span className="font-medium text-foreground">{activeWorkspaceName}</span> ·{" "}
                  {answered} of {ANSWERABLE.length} answered
                </>
              ) : (
                "Create a workspace to set up Brand voice."
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 text-xs sm:inline-flex",
              dirty ? "text-warning-deep" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {dirty ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> All changes saved
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-full lg:inline-flex"
            onClick={() => TourService.startTour("brand_brain", brandBrainTourConfig.steps, undefined, brandBrainTourConfig.driverConfig)}
            aria-label="Take the tour"
            title="Take the tour"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          {saveButton("hidden lg:inline-flex")}
        </div>
      </div>

      <div id="tour-bb-autofill" className="rounded-2xl border border-dashed border-border bg-card/60">
        <button
          type="button"
          onClick={() => setAutofillOpen((o) => !o)}
          disabled={completionPercent < 50}
          aria-expanded={showAutofill}
          className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Fill this in for me</span>
            <span className="block text-xs text-muted-foreground">
              Mako reads your website or a brand document and fills in what it finds. Check it, then save.
            </span>
          </span>
          {completionPercent >= 50 && (
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showAutofill && "rotate-180")} />
          )}
        </button>
        {showAutofill && (
          <div className="grid gap-4 border-t border-dashed border-border px-4 py-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="scrape-url" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" /> From your website
              </Label>
              <div className="flex gap-2">
                <Input
                  id="scrape-url"
                  placeholder="https://yourcompany.com"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  disabled={scraping}
                />
                <Button onClick={() => void handleScrape()} disabled={scraping || !scrapeUrl.trim()} variant="outline" className="shrink-0">
                  {scraping ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading…</> : "Fill in"}
                </Button>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> From a document
              </p>
              <DocumentUpload onResult={handleParsedDocument} disabled={scraping} workspaceId={activeWorkspace} />
            </div>
          </div>
        )}
      </div>

      <div id="tour-bb-tabs" className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Brand voice sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {sections.map((sec) => {
              const done = countFor(sec);
              const complete = done === sec.fields.length;
              const current = sec.id === section.id;
              return (
                <li key={sec.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab(sec.id)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors lg:py-2.5",
                      current
                        ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground lg:border-transparent lg:bg-transparent lg:hover:bg-muted/60",
                    )}
                  >
                    <sec.icon className={cn("h-4 w-4 shrink-0", current && "text-primary")} />
                    <span className="flex-1 whitespace-nowrap">{sec.label}</span>
                    {complete ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-deep" aria-label="Complete" />
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {done}/{sec.fields.length}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="min-w-0 rounded-2xl border border-border/70 bg-card" aria-labelledby="bb-section-title">
          <header className="flex items-start gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <section.icon className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0">
              <h2 id="bb-section-title" className="font-display text-lg font-semibold">{section.label}</h2>
              <p className="text-sm text-muted-foreground">{section.intro}</p>
            </div>
          </header>

          <div className="divide-y divide-border/60">
            {section.id === "company" && (
              <div className="space-y-2 px-5 py-5 sm:px-6">
                <p id="bb-brand-type" className="text-sm font-medium">What kind of brand is this?</p>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="bb-brand-type">
                  {BRAND_TYPES.map((t) => {
                    const selected = data.brandType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => updateField("brandType", t.value)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block text-xs text-muted-foreground">{t.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {!filled(data, field.key) && <span className="text-xs text-muted-foreground">Not answered</span>}
                </div>
                <FormFieldAi
                  id={field.key}
                  form="brand-brain"
                  tenantId={tenant?.id}
                  fieldKey={field.key}
                  type={field.type}
                  value={data[field.key]}
                  onChange={(value) => updateField(field.key, value)}
                  placeholder={field.placeholder}
                  rows={field.rows ?? 4}
                />
              </div>
            ))}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-4 sm:px-6">
            <span className="text-xs text-muted-foreground">
              {countFor(section)} of {section.fields.length} answered in {section.label}
            </span>
            {nextSection ? (
              <Button variant="outline" className="gap-1.5" onClick={() => setActiveTab(nextSection.id)}>
                Next: {nextSection.label} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              saveButton()
            )}
          </footer>
        </section>
      </div>

      {/* Phones and tablets: keep Save in reach while editing. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm text-warning-deep">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes
            </span>
            {saveButton()}
          </div>
        </div>
      )}
    </div>
  );
};

export default function BrandBrain() {
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  return (
    <BrandBrainInner key={`${activeWorkspace ?? "none"}-${workspaceVersion}`} />
  );
}
