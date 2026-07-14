import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Link2, Facebook, Linkedin, Instagram, Twitter, MessageCircle, CheckCircle2, XCircle, Loader2, Phone, Youtube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { socialAccountsApi, SocialAccount } from "@/lib/api";
import { capabilityOf } from "@/lib/platform-capabilities";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// type OAuthPlatform = "facebook" | "linkedin" | "instagram" | "youtube" | "whatsapp" | "tiktok";
type OAuthPlatform = "facebook" | "linkedin" | "instagram" | "youtube" | "whatsapp" | "tiktok";
type ManualPlatform = "twitter";
type PlatformId = OAuthPlatform | ManualPlatform;

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

type WhatsAppPhoneOption = {
  id: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  wabaId: string;
  wabaName?: string;
};

type FacebookPageOption = {
  id: string;
  name: string;
  category?: string;
};

// const oauthPlatforms: OAuthPlatform[] = ["facebook", "linkedin", "instagram", "youtube", "whatsapp", "tiktok"];
const oauthPlatforms: OAuthPlatform[] = ["facebook", "linkedin", "instagram", "youtube", "whatsapp", "tiktok"];
const platforms: {
  id: PlatformId;
  name: string;
  icon: typeof Facebook;
  color: string;
  bgColor: string;
  description: string;
  oauth?: boolean;
  manualFallback?: boolean;
  fields?: { key: string; label: string; placeholder: string; type?: string }[];
}[] = [
  {
    id: "facebook",
    name: "Facebook",
    icon: Facebook,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    description: "Publish posts to your Facebook Page (requires Page admin)",
    oauth: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    description: "Post to your LinkedIn profile (w_member_social permission)",
    oauth: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    description: "Publish via Facebook — IG Business account linked to a Page required",
    oauth: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "text-red-600",
    bgColor: "bg-red-50",
    description: "Upload videos to your YouTube channel (YouTube Data API v3)",
    oauth: true,
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: Twitter,
    color: "text-foreground",
    bgColor: "bg-muted",
    description: "Tweet directly from Mako ",
    fields: [
      { key: "api_key", label: "API Key (Consumer Key)", placeholder: "Consumer Key from developer portal", type: "password" },
      { key: "api_secret", label: "API Secret (Consumer Secret)", placeholder: "Consumer Secret from developer portal", type: "password" },
      { key: "access_token", label: "Access Token", placeholder: "OAuth 1.0a Access Token", type: "password" },
      { key: "access_token_secret", label: "Access Token Secret", placeholder: "OAuth 1.0a Access Token Secret", type: "password" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: TikTokIcon,
    color: "text-foreground",
    bgColor: "bg-gray-100",
    description: "Publish videos via TikTok Content Posting API (OAuth)",
    oauth: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    description: "Connect via Meta and pick your WhatsApp Business phone number",
    oauth: true,
    manualFallback: true,
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "WhatsApp Business phone number ID" },
      { key: "access_token", label: "Access Token", placeholder: "WhatsApp Business access token", type: "password" },
    ],
  },
];

const PublisherConnect = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [connectDialog, setConnectDialog] = useState<PlatformId | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connectingOAuth, setConnectingOAuth] = useState<string | null>(null);
  const [showInstagramWarning, setShowInstagramWarning] = useState(false);

  const [whatsappSetupToken, setWhatsappSetupToken] = useState<string | null>(null);
  const [whatsappPhones, setWhatsappPhones] = useState<WhatsAppPhoneOption[]>([]);
  const [selectedWhatsappPhone, setSelectedWhatsappPhone] = useState<string>("");
  const [loadingWhatsappSetup, setLoadingWhatsappSetup] = useState(false);
  const [finalizingWhatsapp, setFinalizingWhatsapp] = useState(false);

  const [facebookSetupToken, setFacebookSetupToken] = useState<string | null>(null);
  const [facebookPages, setFacebookPages] = useState<FacebookPageOption[]>([]);
  const [facebookProfileName, setFacebookProfileName] = useState<string | null>(null);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<string>("");
  const [loadingFacebookSetup, setLoadingFacebookSetup] = useState(false);
  const [finalizingFacebook, setFinalizingFacebook] = useState(false);

  const [youtubeSetupToken, setYoutubeSetupToken] = useState<string | null>(null);
  const [youtubeChannels, setYoutubeChannels] = useState<Array<{ id: string; title: string; customUrl?: string; thumbnailUrl?: string }>>([]);
  const [youtubeProfileName, setYoutubeProfileName] = useState<string | null>(null);
  const [selectedYoutubeChannel, setSelectedYoutubeChannel] = useState<string>("");
  const [loadingYoutubeSetup, setLoadingYoutubeSetup] = useState(false);
  const [finalizingYoutube, setFinalizingYoutube] = useState(false);



  const { toast } = useToast();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaces, workspaceVersion } = useWorkspace();
  const activeWorkspaceName =
    workspaces.find((w: { id: string }) => w.id === activeWorkspace)?.name;

  const loadAccounts = async () => {
    if (!tenant || !activeWorkspace) return;
    setLoadingAccounts(true);
    try {
      const data = await socialAccountsApi.findByTenant(tenant.id, activeWorkspace);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load accounts";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoadingAccounts(false);
    }
  };



  useEffect(() => {
    if (tenant && activeWorkspace) loadAccounts();
  }, [tenant?.id, activeWorkspace, workspaceVersion]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    const whatsappSetup = searchParams.get("whatsapp_setup");
    const facebookSetup = searchParams.get("facebook_setup");
    const youtubeSetup = searchParams.get("youtube_setup");

    if (connected) {
      toast({ title: "Connected!", description: `${connected} account linked to this workspace.` });
      loadAccounts();
      searchParams.delete("connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (error) {
      toast({ title: "Connection failed", description: decodeURIComponent(error), variant: "destructive" });
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }
    if (whatsappSetup) {
      setWhatsappPhones([]);
      setWhatsappSetupToken(whatsappSetup);
      searchParams.delete("whatsapp_setup");
      setSearchParams(searchParams, { replace: true });
    }
    if (facebookSetup) {
      setFacebookPages([]);
      setFacebookSetupToken(facebookSetup);
      searchParams.delete("facebook_setup");
      setSearchParams(searchParams, { replace: true });
    }
    if (youtubeSetup) {
      setYoutubeChannels([]);
      setYoutubeSetupToken(youtubeSetup);
      searchParams.delete("youtube_setup");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!facebookSetupToken) return;
    if (facebookPages.length > 0) {
      setLoadingFacebookSetup(false);
      return;
    }

    let cancelled = false;
    setLoadingFacebookSetup(true);
    setSelectedFacebookPage("");

    socialAccountsApi
      .getFacebookSetup(facebookSetupToken)
      .then((data) => {
        if (cancelled) return;
        const pages = data.pages ?? [];
        setFacebookPages(pages);
        setFacebookProfileName(data.profileName ?? null);
        if (pages.length === 1) {
          setSelectedFacebookPage(pages[0].id);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load Facebook Pages";
        toast({ title: "Facebook setup failed", description: message, variant: "destructive" });
        setFacebookSetupToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFacebookSetup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facebookSetupToken]);

  useEffect(() => {
    if (!youtubeSetupToken) return;
    if (youtubeChannels.length > 0) {
      setLoadingYoutubeSetup(false);
      return;
    }

    let cancelled = false;
    setLoadingYoutubeSetup(true);
    setSelectedYoutubeChannel("");

    socialAccountsApi
      .getYoutubeSetup(youtubeSetupToken)
      .then((data) => {
        if (cancelled) return;
        const channels = data.channels ?? [];
        setYoutubeChannels(channels);
        setYoutubeProfileName(data.profileName ?? null);
        if (channels.length === 1) {
          setSelectedYoutubeChannel(channels[0].id);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load YouTube channels";
        toast({ title: "YouTube setup failed", description: message, variant: "destructive" });
        setYoutubeSetupToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingYoutubeSetup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [youtubeSetupToken]);

  useEffect(() => {
    if (!whatsappSetupToken) return;
    if (whatsappPhones.length > 0) {
      setLoadingWhatsappSetup(false);
      return;
    }

    let cancelled = false;
    setLoadingWhatsappSetup(true);
    setSelectedWhatsappPhone("");

    socialAccountsApi
      .getWhatsappSetup(whatsappSetupToken)
      .then((data) => {
        if (cancelled) return;
        const phones = data.phones ?? [];
        setWhatsappPhones(phones);
        if (phones.length === 1) {
          setSelectedWhatsappPhone(phones[0].id);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load WhatsApp numbers";
        toast({ title: "WhatsApp setup failed", description: message, variant: "destructive" });
        setWhatsappSetupToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingWhatsappSetup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [whatsappSetupToken]);

  const startOAuthConnect = async (platform: OAuthPlatform) => {
    if (!tenant || !activeWorkspace) {
      toast({ title: "No workspace", description: "Select or create a workspace before connecting accounts.", variant: "destructive" });
      return;
    }

    setConnectingOAuth(platform);
    try {
      const returnUrl = `${window.location.origin}/publisher`;
      const { redirectUrl } = await socialAccountsApi.startOAuth(platform, tenant.id, returnUrl, activeWorkspace);
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth";
      toast({ title: "Connection failed", description: message, variant: "destructive" });
      setConnectingOAuth(null);
    }
  };

  const startWhatsappConnect = async () => {
    if (!tenant || !activeWorkspace) {
      toast({ title: "No workspace", description: "Select or create a workspace before connecting accounts.", variant: "destructive" });
      return;
    }

    setConnectingOAuth("whatsapp");
    try {
      const result = await socialAccountsApi.setupWhatsappFromMeta(tenant.id, activeWorkspace);

      if (result.ready) {
        setWhatsappPhones(result.phones);
        setWhatsappSetupToken(result.setupToken);
        if (result.phones.length === 1) {
          setSelectedWhatsappPhone(result.phones[0].id);
        }
        toast({
          title: "Facebook account reused",
          description: "Pick the WhatsApp number to link — no Meta login needed.",
        });
        setConnectingOAuth(null);
        return;
      }

      if (result.reason === "missing_scopes") {
        toast({
          title: "WhatsApp permissions needed",
          description: "Redirecting to Meta to grant WhatsApp access…",
        });
      } else if (result.reason === "no_facebook") {
        toast({
          title: "Sign in with Meta",
          description: "Connect WhatsApp via Meta — or connect Facebook first for a faster setup next time.",
        });
      }

      await startOAuthConnect("whatsapp");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start WhatsApp connect";
      toast({ title: "Connection failed", description: message, variant: "destructive" });
      setConnectingOAuth(null);
    }
  };

  const handleManualConnect = async (platformId: ManualPlatform | "whatsapp") => {
    if (!tenant || !activeWorkspace) return;

    const accessToken = formValues.access_token;
    if (!accessToken) {
      toast({ title: "Missing token", description: "Access token is required.", variant: "destructive" });
      return;
    }

    if (platformId === "whatsapp" && !formValues.phone_number_id) {
      toast({ title: "Missing phone number ID", description: "Phone Number ID is required for WhatsApp.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await socialAccountsApi.connect({
        tenantId: tenant.id,
        workspaceId: activeWorkspace ?? undefined,
        platform: platformId,
        accountName: accountName || platformId,
        accessToken,
        metadata: { ...formValues },
      } as Parameters<typeof socialAccountsApi.connect>[0] & { workspaceId?: string });
      toast({ title: "Connected!", description: `${platformId} account connected to this workspace.` });
      setConnectDialog(null);
      setFormValues({});
      setAccountName("");
      loadAccounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to connect account";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeFacebook = async () => {
    if (!facebookSetupToken || !selectedFacebookPage) {
      toast({ title: "Select a Page", description: "Choose a Facebook Page to connect.", variant: "destructive" });
      return;
    }

    setFinalizingFacebook(true);
    try {
      await socialAccountsApi.finalizeFacebook({
        setupToken: facebookSetupToken,
        pageId: selectedFacebookPage,
      });
      toast({ title: "Connected!", description: "Facebook Page linked to this workspace." });
      setFacebookSetupToken(null);
      setFacebookPages([]);
      setFacebookProfileName(null);
      setSelectedFacebookPage("");
      loadAccounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to connect Facebook Page";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setFinalizingFacebook(false);
    }
  };

  const handleFinalizeYoutube = async () => {
    if (!youtubeSetupToken || !selectedYoutubeChannel) {
      toast({ title: "Select a channel", description: "Choose a YouTube channel to connect.", variant: "destructive" });
      return;
    }

    setFinalizingYoutube(true);
    try {
      await socialAccountsApi.finalizeYoutube({
        setupToken: youtubeSetupToken,
        channelId: selectedYoutubeChannel,
      });
      toast({ title: "Connected!", description: "YouTube channel linked to this workspace." });
      setYoutubeSetupToken(null);
      setYoutubeChannels([]);
      setYoutubeProfileName(null);
      setSelectedYoutubeChannel("");
      loadAccounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to connect YouTube channel";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setFinalizingYoutube(false);
    }
  };

  const handleFinalizeWhatsapp = async () => {
    if (!whatsappSetupToken || !selectedWhatsappPhone) {
      toast({ title: "Select a number", description: "Choose a WhatsApp phone number to connect.", variant: "destructive" });
      return;
    }

    setFinalizingWhatsapp(true);
    try {
      await socialAccountsApi.finalizeWhatsapp({
        setupToken: whatsappSetupToken,
        phoneNumberId: selectedWhatsappPhone,
      });
      toast({ title: "Connected!", description: "WhatsApp Business number linked to this workspace." });
      setWhatsappSetupToken(null);
      setWhatsappPhones([]);
      setSelectedWhatsappPhone("");
      loadAccounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to connect WhatsApp";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setFinalizingWhatsapp(false);
    }
  };

  const handleDisconnect = async (account: SocialAccount) => {
    if (!tenant) return;
    try {
      await socialAccountsApi.disconnect(account.id, tenant.id);
      toast({ title: "Disconnected", description: `${account.platform} account disconnected.` });
      loadAccounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to disconnect";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const getAccount = (platformId: string) =>
    accounts.find((a) => a.platform === platformId && a.connected);

  const activePlatform = platforms.find((p) => p.id === connectDialog);

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-secondary">
          <Link2 className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Publisher Connect</h1>
          <p className="text-muted-foreground text-sm">
            {activeWorkspaceName
              ? `Publisher connections for “${activeWorkspaceName}”. Switch workspace in the top navbar.`
              : "Select a workspace to connect social accounts."}
          </p>
        </div>
      </div>

      {!tenant && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 text-sm text-amber-800">
            No workspace selected. Create or select a workspace before connecting publisher accounts.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms
          .filter((p) => capabilityOf(p.id)?.connect)
          .map((platform) => {
          const cap = capabilityOf(platform.id);
          const isComingSoon = cap?.status === 'coming_soon';
          const account = getAccount(platform.id);
          const Icon = platform.icon;
          const isOAuth = platform.oauth === true;
          const isConnecting = connectingOAuth === platform.id;
          const whatsappNotes = cap?.notes ?? platform.description;

          return (
            <Card key={platform.id} className={`border-border/50 hover:shadow-card transition-shadow ${isComingSoon ? 'opacity-75' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${platform.bgColor}`}>
                      <Icon className={`h-5 w-5 ${platform.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{platform.name}</h3>
                        {isComingSoon && (
                          <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {whatsappNotes}
                      </p>
                      {account && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Connected</span>
                          {account.accountName && (
                            <span className="text-xs text-muted-foreground">• {account.accountName}</span>
                          )}
                        </div>
                      )}
                      {platform.id === "whatsapp" && !account && getAccount("facebook") && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Facebook connected — will reuse if WhatsApp permissions are already granted.
                        </p>
                      )}
                    </div>
                  </div>
                  {isComingSoon ? (
                    <Button size="sm" variant="outline" disabled>
                      Unavailable
                    </Button>
                  ) : account ? (
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleDisconnect(account)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Disconnect
                    </Button>
                  ) : isOAuth ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        size="sm"
                        className="gradient-primary text-primary-foreground border-0"
                        disabled={!tenant || isConnecting || loadingAccounts}
                        onClick={() => {
                          if (platform.id === "instagram") {
                            setShowInstagramWarning(true);
                          } else if (platform.id === "whatsapp") {
                            startWhatsappConnect();
                          } else {
                            startOAuthConnect(platform.id as OAuthPlatform);
                          }
                        }}
                      >
                        {isConnecting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
                        {isConnecting ? "Redirecting..." : "Connect"}
                      </Button>
                      {platform.manualFallback && (
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={() => setConnectDialog(platform.id)}
                        >
                          Enter credentials manually
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button size="sm" className="gradient-primary text-primary-foreground border-0" onClick={() => setConnectDialog(platform.id)}>
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-5">
          <h3 className="font-semibold text-sm mb-2">How it works</h3>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Connect accounts per workspace — each tenant has its own publisher connections</li>
            <li>Create content in the Content Engine</li>
            <li>Publish and pick platforms — previews show per channel</li>
            <li>Content goes live on connected accounts for this workspace</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            OAuth redirect URI for each platform: <code className="text-[10px]">/api/v1/social-accounts/oauth/&#123;platform&#125;/callback</code>
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            Already connected before a scope update? Disconnect and reconnect so publish permissions (e.g. Instagram content publish) are granted.
          </p>
        </CardContent>
      </Card>

      <Sheet
        open={!!connectDialog && !oauthPlatforms.includes(connectDialog as OAuthPlatform)}
        onOpenChange={(open) => {
          if (!open) {
            setConnectDialog(null);
            setFormValues({});
            setAccountName("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">
              Connect {activePlatform?.name}
            </SheetTitle>
          </SheetHeader>
          {connectDialog && activePlatform?.fields && (
            <div className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Advanced: paste credentials from Meta Business Manager if OAuth is unavailable.
              </p>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input placeholder="e.g., My Business Page" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </div>
              {activePlatform.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.type || "text"}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ""}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
              <Button
                onClick={() => handleManualConnect(connectDialog as ManualPlatform | "whatsapp")}
                disabled={saving || !tenant}
                className="w-full gradient-primary text-primary-foreground border-0"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                {saving ? "Connecting..." : "Connect Account"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!facebookSetupToken}
        onOpenChange={(open) => {
          if (!open) {
            setFacebookSetupToken(null);
            setFacebookPages([]);
            setFacebookProfileName(null);
            setSelectedFacebookPage("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Choose Facebook Page</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Select the Page to publish from
              {facebookProfileName ? ` for ${facebookProfileName}` : ""}.
            </p>

            {loadingFacebookSetup ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading Pages…
              </div>
            ) : facebookPages.length === 0 ? (
              <p className="text-sm text-destructive">
                No Pages found. Close and try connecting again with a Meta account that manages a Page.
              </p>
            ) : (
              <RadioGroup value={selectedFacebookPage} onValueChange={setSelectedFacebookPage}>
                {facebookPages.map((page) => (
                  <label
                    key={page.id}
                    htmlFor={`fb-${page.id}`}
                    className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/40"
                  >
                    <RadioGroupItem value={page.id} id={`fb-${page.id}`} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="font-medium text-sm">{page.name}</span>
                      </div>
                      {page.category && (
                        <p className="text-xs text-muted-foreground mt-0.5">{page.category}</p>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <Button
              onClick={handleFinalizeFacebook}
              disabled={finalizingFacebook || loadingFacebookSetup || !selectedFacebookPage}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              {finalizingFacebook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {finalizingFacebook ? "Connecting..." : "Connect Page"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!youtubeSetupToken}
        onOpenChange={(open) => {
          if (!open) {
            setYoutubeSetupToken(null);
            setYoutubeChannels([]);
            setYoutubeProfileName(null);
            setSelectedYoutubeChannel("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Choose YouTube channel</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Select the channel to publish videos from
              {youtubeProfileName ? ` for ${youtubeProfileName}` : ""}.
            </p>

            {loadingYoutubeSetup ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading channels…
              </div>
            ) : youtubeChannels.length === 0 ? (
              <p className="text-sm text-destructive">
                No channels found. Create a YouTube channel with this Google account, then connect again.
              </p>
            ) : (
              <RadioGroup value={selectedYoutubeChannel} onValueChange={setSelectedYoutubeChannel}>
                {youtubeChannels.map((channel) => (
                  <label
                    key={channel.id}
                    htmlFor={`yt-${channel.id}`}
                    className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/40"
                  >
                    <RadioGroupItem value={channel.id} id={`yt-${channel.id}`} className="mt-0.5" />
                    <div className="min-w-0 flex items-center gap-3">
                      {channel.thumbnailUrl ? (
                        <img src={channel.thumbnailUrl} alt="" className="h-8 w-8 rounded-full shrink-0" />
                      ) : (
                        <Youtube className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-medium text-sm">{channel.title}</span>
                        {channel.customUrl && (
                          <p className="text-xs text-muted-foreground mt-0.5">@{channel.customUrl}</p>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <Button
              onClick={handleFinalizeYoutube}
              disabled={finalizingYoutube || loadingYoutubeSetup || !selectedYoutubeChannel}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              {finalizingYoutube ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {finalizingYoutube ? "Connecting..." : "Connect channel"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!whatsappSetupToken}
        onOpenChange={(open) => {
          if (!open) {
            setWhatsappSetupToken(null);
            setWhatsappPhones([]);
            setSelectedWhatsappPhone("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Choose WhatsApp number</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Select the WhatsApp Business phone number to use for this workspace.
            </p>

            {loadingWhatsappSetup ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading phone numbers…
              </div>
            ) : whatsappPhones.length === 0 ? (
              <p className="text-sm text-destructive">
                No phone numbers found. Close and try connecting again from Meta Business Settings.
              </p>
            ) : (
              <RadioGroup value={selectedWhatsappPhone} onValueChange={setSelectedWhatsappPhone}>
                {whatsappPhones.map((phone) => (
                  <label
                    key={phone.id}
                    htmlFor={`wa-${phone.id}`}
                    className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/40"
                  >
                    <RadioGroupItem value={phone.id} id={`wa-${phone.id}`} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span className="font-medium text-sm">
                          {phone.displayPhoneNumber || phone.verifiedName || phone.id}
                        </span>
                      </div>
                      {phone.verifiedName && phone.displayPhoneNumber && (
                        <p className="text-xs text-muted-foreground mt-0.5">{phone.verifiedName}</p>
                      )}
                      {phone.wabaName && (
                        <p className="text-xs text-muted-foreground mt-0.5">WABA: {phone.wabaName}</p>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <Button
              onClick={handleFinalizeWhatsapp}
              disabled={finalizingWhatsapp || loadingWhatsappSetup || !selectedWhatsappPhone}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              {finalizingWhatsapp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {finalizingWhatsapp ? "Connecting..." : "Connect WhatsApp"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showInstagramWarning} onOpenChange={setShowInstagramWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Instagram Connection Requirements</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-left">
              <p>
                To use this feature, you need to switch your Instagram account to a <strong>Creator</strong> or <strong>Business</strong> account and link it to a Facebook Page.
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-md text-sm">
                <strong>⚠️ Important:</strong> This will make your account public and automatically accept all pending follow requests. Your username, followers, and existing posts will remain the same.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                window.open("https://accountscenter.instagram.com/", "_blank");
              }}
            >
              Take me to Settings
            </Button>
            <Button
              className="gradient-primary text-primary-foreground border-0"
              onClick={() => {
                setShowInstagramWarning(false);
                startOAuthConnect("instagram");
              }}
            >
              I've done this, Connect
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PublisherConnect;
