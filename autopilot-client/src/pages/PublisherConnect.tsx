import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Link2, Facebook, Linkedin, Instagram, Twitter, MessageCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { socialAccountsApi, SocialAccount } from "@/lib/api";

type OAuthPlatform = "facebook" | "linkedin" | "instagram" | "google";
type ManualPlatform = "twitter" | "tiktok" | "whatsapp";
type PlatformId = OAuthPlatform | ManualPlatform;

const oauthPlatforms: OAuthPlatform[] = ["facebook", "linkedin", "instagram", "google"];

const platforms: {
  id: PlatformId;
  name: string;
  icon: typeof Facebook;
  color: string;
  bgColor: string;
  description: string;
  oauth?: boolean;
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
    id: "twitter",
    name: "X / Twitter",
    icon: Twitter,
    color: "text-foreground",
    bgColor: "bg-muted",
    description: "Tweet directly from AutoPilot",
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
    icon: Instagram,
    color: "text-black",
    bgColor: "bg-gray-100",
    description: "Publish videos to TikTok Business account",
    fields: [
      { key: "client_key", label: "Client Key (App ID)", placeholder: "TikTok Client Key" },
      { key: "client_secret", label: "Client Secret", placeholder: "TikTok Client Secret", type: "password" },
      { key: "access_token", label: "Access Token", placeholder: "TikTok OAuth access token", type: "password" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    description: "Send content via WhatsApp Business API",
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

  const { toast } = useToast();
  const { tenant } = useTenant();

  const loadAccounts = async () => {
    if (!tenant) return;
    setLoadingAccounts(true);
    try {
      const data = await socialAccountsApi.findByTenant(tenant.id);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load accounts";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (tenant) loadAccounts();
  }, [tenant?.id]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
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
  }, [searchParams]);

  const startOAuthConnect = async (platform: OAuthPlatform) => {
    if (!tenant) {
      toast({ title: "No workspace", description: "Select or create a workspace before connecting accounts.", variant: "destructive" });
      return;
    }

    setConnectingOAuth(platform);
    try {
      const returnUrl = `${window.location.origin}/publisher`;
      const { redirectUrl } = await socialAccountsApi.startOAuth(platform, tenant.id, returnUrl);
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth";
      toast({ title: "Connection failed", description: message, variant: "destructive" });
      setConnectingOAuth(null);
    }
  };

  const handleManualConnect = async (platformId: ManualPlatform) => {
    if (!tenant) return;

    const accessToken = formValues.access_token;
    if (!accessToken) {
      toast({ title: "Missing token", description: "Access token is required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await socialAccountsApi.connect({
        tenantId: tenant.id,
        platform: platformId,
        accountName: accountName || platformId,
        accessToken,
        metadata: { ...formValues },
      });
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-secondary">
          <Link2 className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Publisher Connect</h1>
          <p className="text-muted-foreground text-sm">
            Connect social accounts for <strong>{tenant?.name ?? "your workspace"}</strong>
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
        {platforms.map((platform) => {
          const account = getAccount(platform.id);
          const Icon = platform.icon;
          const isOAuth = platform.oauth === true;
          const isConnecting = connectingOAuth === platform.id;

          return (
            <Card key={platform.id} className="border-border/50 hover:shadow-card transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${platform.bgColor}`}>
                      <Icon className={`h-5 w-5 ${platform.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{platform.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{platform.description}</p>
                      {account && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Connected</span>
                          {account.accountName && (
                            <span className="text-xs text-muted-foreground">• {account.accountName}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {account ? (
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleDisconnect(account)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Disconnect
                    </Button>
                  ) : isOAuth ? (
                    <Button
                      size="sm"
                      className="gradient-primary text-primary-foreground border-0"
                      disabled={!tenant || isConnecting || loadingAccounts}
                      onClick={() => startOAuthConnect(platform.id as OAuthPlatform)}
                    >
                      {isConnecting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
                      {isConnecting ? "Redirecting..." : "Connect"}
                    </Button>
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

      <Sheet open={!!connectDialog && !oauthPlatforms.includes(connectDialog as OAuthPlatform)} onOpenChange={(open) => { if (!open) { setConnectDialog(null); setFormValues({}); setAccountName(""); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">
              Connect {activePlatform?.name}
            </SheetTitle>
          </SheetHeader>
          {connectDialog && activePlatform?.fields && (
            <div className="space-y-4 mt-4">
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
                onClick={() => handleManualConnect(connectDialog as ManualPlatform)}
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
    </div>
  );
};

export default PublisherConnect;
