import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Link2,
  Facebook,
  Linkedin,
  Instagram,
  Twitter,
  MessageCircle,
  Loader2,
  Phone,
  Youtube,
  HelpCircle,
  MoreHorizontal,
  RefreshCw,
  Unplug,
  KeyRound,
  Plus,
  ShieldCheck,
  Star,
  Hash,
  AtSign,
  Pin,
  Store,
  Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { confirmModal } from "@/components/ConfirmModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { socialAccountsApi, SocialAccount, type ManagedSocialAccount, type AccountHealth } from "@/lib/api";
import { capabilityOf } from "@/lib/platform-capabilities";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TourService } from "@/services/tour.service";
import { publisherConnectTourConfig } from "./PublisherConnect.tour";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type OAuthPlatform =
  | "facebook"
  | "linkedin"
  | "instagram"
  | "youtube"
  | "whatsapp"
  | "tiktok"
  | "twitter"
  | "google"
  | "threads"
  | "pinterest"
  | "google_business";
/** Alternative sign-ins that save under an existing platform. */
type AltProvider = "instagram_login" | "linkedin_page";
type ManualPlatform = "twitter";
type PlatformId = OAuthPlatform | ManualPlatform | "telegram";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
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

const oauthPlatforms: OAuthPlatform[] = ["facebook", "linkedin", "instagram", "youtube", "whatsapp", "tiktok", "twitter", "google"];
const platforms: {
  id: PlatformId;
  name: string;
  /** Lucide icons and the custom TikTok/Google marks; only className is passed. */
  icon: React.ComponentType<{ className?: string }>;
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
    description: "Post to a Facebook Page you manage, and answer its comments and messages.",
    oauth: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    description: "Post to your LinkedIn profile.",
    oauth: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    description: "Post to an Instagram business or creator account linked to a Facebook Page.",
    oauth: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "text-red-600",
    bgColor: "bg-red-50",
    description: "Upload videos to your YouTube channel.",
    oauth: true,
  },
  {
    id: "google",
    name: "Google Ads & Drive",
    icon: GoogleIcon,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    description: "Run Google Ads and use media from Google Drive.",
    oauth: true,
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: Twitter,
    color: "text-foreground",
    bgColor: "bg-muted",
    description: "Post to X and see replies and messages in your inbox.",
    oauth: true,
    manualFallback: true,
    fields: [
      {
        key: "api_key",
        label: "API Key (Consumer Key)",
        placeholder: "Consumer Key from X Developer Portal",
        type: "password",
      },
      {
        key: "api_secret",
        label: "API Secret (Consumer Secret)",
        placeholder: "Consumer Secret from X Developer Portal",
        type: "password",
      },
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "OAuth 1.0a Access Token",
        type: "password",
      },
      {
        key: "access_token_secret",
        label: "Access Token Secret",
        placeholder: "OAuth 1.0a Access Token Secret",
        type: "password",
      },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: TikTokIcon,
    color: "text-foreground",
    bgColor: "bg-gray-100",
    description: "Post videos to TikTok.",
    oauth: true,
  },
  {
    id: "threads",
    name: "Threads",
    icon: AtSign,
    color: "text-foreground",
    bgColor: "bg-muted",
    description: "Post to your Threads profile.",
    oauth: true,
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: Pin,
    color: "text-red-600",
    bgColor: "bg-red-50",
    description: "Pin posts with an image to one of your boards.",
    oauth: true,
  },
  {
    id: "google_business",
    name: "Google Business Profile",
    icon: Store,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    description: "Post updates to your business listing on Google Search and Maps.",
    oauth: true,
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: Send,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    description: "A bot you create posts to your Telegram channel or group.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    description: "Use your WhatsApp Business number for chats and the WhatsApp bot.",
    oauth: true,
    manualFallback: true,
    fields: [
      {
        key: "phone_number_id",
        label: "Phone Number ID",
        placeholder: "WhatsApp Business phone number ID",
      },
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "WhatsApp Business access token",
        type: "password",
      },
    ],
  },
];

type Tone = "ok" | "warn" | "bad";
const TONE: Record<Tone, { dot: string; text: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  warn: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  bad: { dot: "bg-destructive", text: "text-destructive" },
};

/**
 * Whether a connection still works: lost access first, then the last check's result,
 * then when its access expires, then any missing permissions.
 */
function health(account: SocialAccount): {
  tone: Tone;
  label: string;
  detail?: string;
} {
  const meta = (account.metadata ?? {}) as Record<string, unknown>;
  const check = meta.health as AccountHealth | undefined;
  if (!account.connected) {
    return {
      tone: "bad",
      label: "Lost access",
      detail: (meta.auth_error as string) || "Reconnect to keep posting.",
    };
  }
  if (check?.status === "revoked") return { tone: "bad", label: "Access removed", detail: check.message };
  if (account.expiresAt) {
    const days = differenceInCalendarDays(new Date(account.expiresAt), new Date());
    const on = format(new Date(account.expiresAt), "d MMM yyyy");
    if (days < 0)
      return {
        tone: "bad",
        label: "Access expired",
        detail: `Expired ${on}. Reconnect to keep posting.`,
      };
    if (days <= 14)
      return {
        tone: "warn",
        label: days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`,
        detail: `Access ends ${on}.`,
      };
  }
  if (check?.missing?.length) {
    return {
      tone: "warn",
      label: "Missing permissions",
      detail: check.missing.map((m) => m.feature).join(", ") + " won't work until you reconnect and allow them.",
    };
  }
  if (check?.status === "unchecked") return { tone: "ok", label: "Connected", detail: check.message };
  return {
    tone: "ok",
    label: "Working",
    detail: check?.checkedAt
      ? `Checked ${formatDistanceToNow(new Date(check.checkedAt), {
          addSuffix: true,
        })}`
      : undefined,
  };
}

/** "Posts · Comments · Messages": what Mako can do once a channel is connected. */
function CapabilityList({ cap }: { cap: NonNullable<ReturnType<typeof capabilityOf>> }) {
  const items = [cap.publish && "Posts", cap.comments && "Comments", cap.messaging && "Messages", cap.id === "google" && "Ads & Drive"].filter(Boolean);
  if (!items.length) return null;
  return <span>{items.join(" · ")}</span>;
}

const PublisherConnect = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<ManagedSocialAccount[]>([]);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [defaultsFor, setDefaultsFor] = useState<{
    account: ManagedSocialAccount;
    hashtags: string;
    firstComment: string;
  } | null>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegramForm, setTelegramForm] = useState({ botToken: "", chat: "" });
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  /** After signing in to LinkedIn Pages, Pinterest or Google Business: pick which one. */
  const [channelSetup, setChannelSetup] = useState<{
    token: string;
    title?: string;
    choices?: Array<{ id: string; name: string; subtitle?: string }>;
    picked?: string;
  } | null>(null);
  const [finalizingChannel, setFinalizingChannel] = useState(false);
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
  const [youtubeChannels, setYoutubeChannels] = useState<
    Array<{
      id: string;
      title: string;
      customUrl?: string;
      thumbnailUrl?: string;
    }>
  >([]);
  const [youtubeProfileName, setYoutubeProfileName] = useState<string | null>(null);
  const [selectedYoutubeChannel, setSelectedYoutubeChannel] = useState<string>("");
  const [loadingYoutubeSetup, setLoadingYoutubeSetup] = useState(false);
  const [finalizingYoutube, setFinalizingYoutube] = useState(false);

  const [twitterWebhook, setTwitterWebhook] = useState<{
    webhookUrl: string;
    webhookEnv: string;
    subscriptions: string[];
    notes?: string;
  } | null>(null);
  const { tenant } = useTenant();
  const { activeWorkspace, workspaces, workspaceVersion } = useWorkspace();
  const { toast } = useToast();
  const activeWorkspaceName = workspaces.find((w: { id: string }) => w.id === activeWorkspace)?.name;
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        TourService.autoStartTour("connections", publisherConnectTourConfig.steps, undefined, publisherConnectTourConfig.driverConfig);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!tenant || !activeWorkspace) return;
    setLoadingAccounts(true);
    try {
      const data = await socialAccountsApi.manage(tenant.id, activeWorkspace);
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
    let cancelled = false;
    socialAccountsApi
      .getTwitterWebhookConfig()
      .then((cfg) => {
        if (!cancelled) setTwitterWebhook(cfg);
      })
      .catch(() => {
        if (!cancelled) setTwitterWebhook(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    const whatsappSetup = searchParams.get("whatsapp_setup");
    const facebookSetup = searchParams.get("facebook_setup");
    const youtubeSetup = searchParams.get("youtube_setup");
    const channelSetupToken = searchParams.get("channel_setup");
    if (channelSetupToken) {
      setChannelSetup({ token: channelSetupToken });
      searchParams.delete("channel_setup");
      setSearchParams(searchParams, { replace: true });
    }

    if (connected) {
      toast({
        title: "Connected!",
        description: `${connected} account linked to this workspace.`,
      });
      loadAccounts();
      searchParams.delete("connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (error) {
      toast({
        title: "Connection failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
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
        toast({
          title: "Facebook setup failed",
          description: message,
          variant: "destructive",
        });
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
        toast({
          title: "YouTube setup failed",
          description: message,
          variant: "destructive",
        });
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
        toast({
          title: "WhatsApp setup failed",
          description: message,
          variant: "destructive",
        });
        setWhatsappSetupToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingWhatsappSetup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [whatsappSetupToken]);

  const startOAuthConnect = async (platform: OAuthPlatform | AltProvider) => {
    if (!tenant || !activeWorkspace) {
      toast({
        title: "No workspace",
        description: "Select or create a workspace before connecting accounts.",
        variant: "destructive",
      });
      return;
    }

    setConnectingOAuth(platform);
    try {
      const returnUrl = `${window.location.origin}/publisher`;
      const { redirectUrl } = await socialAccountsApi.startOAuth(platform, tenant.id, returnUrl, activeWorkspace);
      if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
        throw new Error("Invalid OAuth redirect URL from server");
      }
      window.location.assign(redirectUrl);
    } catch (error: unknown) {
      setConnectingOAuth(null);
      const message = error instanceof Error ? error.message : "Failed to start OAuth";
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const startWhatsappConnect = async () => {
    if (!tenant || !activeWorkspace) {
      toast({
        title: "No workspace",
        description: "Select or create a workspace before connecting accounts.",
        variant: "destructive",
      });
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

      // Strict null checks are off here, so read the reason with "in" rather than relying on narrowing.
      const reason = "reason" in result ? result.reason : undefined;
      if (reason === "missing_scopes") {
        toast({
          title: "WhatsApp permissions needed",
          description: "Redirecting to Meta to grant WhatsApp access…",
        });
      } else if (reason === "no_facebook") {
        toast({
          title: "Sign in with Meta",
          description: "Connect WhatsApp via Meta — or connect Facebook first for a faster setup next time.",
        });
      }

      await startOAuthConnect("whatsapp");
    } catch (error: unknown) {
      setConnectingOAuth(null);
      const message = error instanceof Error ? error.message : "Failed to start WhatsApp connect";
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleManualConnect = async (platformId: ManualPlatform | "whatsapp") => {
    if (!tenant || !activeWorkspace) return;

    if (platformId === "twitter") {
      const { api_key, api_secret, access_token, access_token_secret } = formValues;
      if (!api_key || !api_secret || !access_token || !access_token_secret) {
        toast({
          title: "Missing credentials",
          description: "All four OAuth 1.0a fields are required for manual X connect.",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);
      try {
        await socialAccountsApi.connect({
          tenantId: tenant.id,
          workspaceId: activeWorkspace ?? undefined,
          platform: "twitter",
          accountName: accountName || "X / Twitter",
          accessToken: access_token,
          metadata: {
            api_key,
            api_secret,
            access_token_secret,
            auth_type: "oauth1",
          },
        } as Parameters<typeof socialAccountsApi.connect>[0] & { workspaceId?: string });
        toast({
          title: "Connected!",
          description: "X / Twitter account connected to this workspace.",
        });
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
      return;
    }

    const accessToken = formValues.access_token;
    if (!accessToken) {
      toast({
        title: "Missing token",
        description: "Access token is required.",
        variant: "destructive",
      });
      return;
    }

    if (platformId === "whatsapp" && !formValues.phone_number_id) {
      toast({
        title: "Missing phone number ID",
        description: "Phone Number ID is required for WhatsApp.",
        variant: "destructive",
      });
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
      toast({
        title: "Connected!",
        description: `${platformId} account connected to this workspace.`,
      });
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
      toast({
        title: "Select a Page",
        description: "Choose a Facebook Page to connect.",
        variant: "destructive",
      });
      return;
    }

    setFinalizingFacebook(true);
    try {
      await socialAccountsApi.finalizeFacebook({
        setupToken: facebookSetupToken,
        pageId: selectedFacebookPage,
      });
      toast({
        title: "Connected!",
        description: "Facebook Page linked to this workspace.",
      });
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
      toast({
        title: "Select a channel",
        description: "Choose a YouTube channel to connect.",
        variant: "destructive",
      });
      return;
    }

    setFinalizingYoutube(true);
    try {
      await socialAccountsApi.finalizeYoutube({
        setupToken: youtubeSetupToken,
        channelId: selectedYoutubeChannel,
      });
      toast({
        title: "Connected!",
        description: "YouTube channel linked to this workspace.",
      });
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
      toast({
        title: "Select a number",
        description: "Choose a WhatsApp phone number to connect.",
        variant: "destructive",
      });
      return;
    }

    setFinalizingWhatsapp(true);
    try {
      await socialAccountsApi.finalizeWhatsapp({
        setupToken: whatsappSetupToken,
        phoneNumberId: selectedWhatsappPhone,
      });
      toast({
        title: "Connected!",
        description: "WhatsApp Business number linked to this workspace.",
      });
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
      toast({
        title: "Disconnected",
        description: `${account.platform} account disconnected.`,
      });
      loadAccounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to disconnect";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const samePlatform = (accountPlatform: string, platformId: string) =>
    accountPlatform === platformId || (platformId === "twitter" && accountPlatform === "x") || (platformId === "x" && accountPlatform === "twitter");

  /** All of a platform's accounts in this workspace, including ones that lost access. */
  const accountsFor = (platformId: string) => accounts.filter((a) => samePlatform(a.platform, platformId));
  const getAccount = (platformId: string) => accountsFor(platformId).find((a) => a.connected);

  const activePlatform = platforms.find((p) => p.id === connectDialog);

  /** Starts the right connect flow for a platform (also used to reconnect or add another). */
  const connect = (id: PlatformId) => {
    if (id === "telegram") setTelegramOpen(true);
    else if (id === "instagram") setShowInstagramWarning(true);
    else if (id === "whatsapp") void startWhatsappConnect();
    else void startOAuthConnect(id as OAuthPlatform);
  };

  const confirmDisconnect = async (account: SocialAccount, name: string) => {
    const ok = await confirmModal(
      "Scheduled posts for this account won't go out, and new comments and messages stop coming into your inbox. You can connect it again any time.",
      `Disconnect ${name}?`,
      "Disconnect"
    );
    if (ok) await handleDisconnect(account);
  };

  const runCheck = async (account: ManagedSocialAccount, name: string) => {
    if (!tenant) return;
    setCheckingId(account.id);
    try {
      const result = await socialAccountsApi.check(account.id, tenant.id);
      toast({
        title: result.status === "ok" && !result.missing.length ? `${name} is working` : `${name}: ${result.message}`,
        description: result.missing.length
          ? `Missing permissions for ${result.missing.map((m) => m.feature).join(", ")}. Reconnect and allow them.`
          : undefined,
        variant: result.status === "revoked" ? "destructive" : undefined,
      });
      await loadAccounts();
    } catch (error: unknown) {
      toast({
        title: "Couldn't check the connection",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCheckingId(null);
    }
  };

  const makeDefault = async (account: ManagedSocialAccount, name: string) => {
    if (!tenant) return;
    try {
      await socialAccountsApi.makeDefault(account.id, tenant.id);
      toast({
        title: `${name} is now the default`,
        description: "New posts go out from it unless you pick another account.",
      });
      await loadAccounts();
    } catch (error: unknown) {
      toast({
        title: "Couldn't change the default",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const saveDefaults = async () => {
    if (!tenant || !defaultsFor) return;
    setSavingDefaults(true);
    try {
      await socialAccountsApi.saveDefaults(defaultsFor.account.id, tenant.id, {
        hashtags: defaultsFor.hashtags,
        firstComment: defaultsFor.firstComment,
      });
      toast({ title: "Post defaults saved" });
      setDefaultsFor(null);
      await loadAccounts();
    } catch (error: unknown) {
      toast({
        title: "Couldn't save",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingDefaults(false);
    }
  };

  // Load the choices once we land back with a channel_setup token.
  useEffect(() => {
    if (!channelSetup || channelSetup.choices) return;
    let cancelled = false;
    socialAccountsApi
      .channelSetup(channelSetup.token)
      .then((data) => {
        if (cancelled) return;
        setChannelSetup({
          token: channelSetup.token,
          title: data.title,
          choices: data.choices,
          picked: data.choices[0]?.id,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast({
          title: "That sign-in has expired",
          description: error instanceof Error ? error.message : "Please connect again.",
          variant: "destructive",
        });
        setChannelSetup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [channelSetup, toast]);

  const finalizeChannel = async () => {
    if (!channelSetup?.picked) return;
    setFinalizingChannel(true);
    try {
      const account = await socialAccountsApi.finalizeChannelSetup(channelSetup.token, channelSetup.picked);
      toast({
        title: "Connected",
        description: account.accountName ? `${account.accountName} is ready to post to.` : undefined,
      });
      setChannelSetup(null);
      await loadAccounts();
    } catch (error: unknown) {
      toast({
        title: "Couldn't connect",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setFinalizingChannel(false);
    }
  };

  const connectTelegram = async () => {
    if (!tenant) return;
    setConnectingTelegram(true);
    try {
      const account = await socialAccountsApi.connectTelegram({
        tenantId: tenant.id,
        workspaceId: activeWorkspace || undefined,
        botToken: telegramForm.botToken.trim(),
        chat: telegramForm.chat.trim(),
      });
      toast({
        title: "Telegram connected",
        description: account.accountName ? `Posts will go to ${account.accountName}.` : undefined,
      });
      setTelegramOpen(false);
      setTelegramForm({ botToken: "", chat: "" });
      await loadAccounts();
    } catch (error: unknown) {
      toast({
        title: "Couldn't connect Telegram",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setConnectingTelegram(false);
    }
  };

  const available = platforms.filter((p) => capabilityOf(p.id)?.connect);
  const rows = available.flatMap((platform) => accountsFor(platform.id).map((account) => ({ platform, account })));
  const connectedPlatformCount = available.filter((p) => getAccount(p.id)).length;
  const needsAttention = rows.filter(({ account }) => health(account).tone !== "ok").length;

  return (
    <div className="w-full min-w-0 space-y-8 pb-12" id="tour-connections-welcome">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Social accounts</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {activeWorkspaceName ? (
              <>
                The accounts <span className="font-medium text-foreground">{activeWorkspaceName}</span> posts to and hears from. Each workspace connects its
                own.
              </>
            ) : (
              "Choose a workspace to connect its accounts."
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hidden self-start sm:flex sm:self-auto"
          onClick={() => TourService.startTour("connections", publisherConnectTourConfig.steps, undefined, publisherConnectTourConfig.driverConfig)}
          aria-label="Show me around"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      {!tenant || !activeWorkspace ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Choose or create a workspace before connecting accounts.
        </div>
      ) : (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums">
              {loadingAccounts && !accounts.length ? "–" : connectedPlatformCount}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                of {available.filter((p) => capabilityOf(p.id)?.status !== "coming_soon").length} channels connected
              </span>
            </p>
            <p className={cn("mt-1 text-sm", needsAttention ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              {needsAttention
                ? `${needsAttention} account${needsAttention === 1 ? " needs" : "s need"} attention`
                : rows.length
                ? "Everything connected is working."
                : "Connect a channel to start publishing."}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-hidden>
            {available.map((p) => {
              const Icon = p.icon;
              const on = Boolean(getAccount(p.id));
              return (
                <span key={p.id} title={p.name} className={cn("flex h-9 w-9 items-center justify-center rounded-xl", on ? p.bgColor : "bg-muted opacity-40")}>
                  <Icon className={cn("h-4 w-4", on ? p.color : "text-muted-foreground")} />
                </span>
              );
            })}
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Connected</h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {rows.map(({ platform, account }) => {
              const Icon = platform.icon;
              const h = health(account);
              const cap = capabilityOf(platform.id);
              const busy = connectingOAuth === platform.id;
              const name = account.accountName || platform.name;
              const handle = account.username && account.username !== account.accountName ? `@${account.username.replace(/^@/, "")}` : null;
              const siblings = accountsFor(platform.id).filter((a) => a.connected);
              const isDefault = account.metadata?.is_default === true;
              const { lastPublishedAt, lastFailedAt, lastError } = account.activity ?? {
                lastPublishedAt: null,
                lastFailedAt: null,
                lastError: null,
              };
              const lastFailedNewer = lastFailedAt && (!lastPublishedAt || new Date(lastFailedAt) > new Date(lastPublishedAt));
              const defaults = (account.metadata?.defaults ?? {}) as {
                hashtags?: string;
                firstComment?: string;
              };
              return (
                <li
                  key={account.id}
                  className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5", !account.connected && "bg-destructive/[0.03]")}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", platform.bgColor, !account.connected && "opacity-50")}
                    >
                      <Icon className={cn("h-5 w-5", platform.color)} />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span className="truncate">
                          {name}
                          {handle && <span className="font-normal text-muted-foreground"> {handle}</span>}
                        </span>
                        {isDefault && siblings.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Star className="h-2.5 w-2.5" /> Default
                          </span>
                        )}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{platform.name}</span>
                        {cap && <span aria-hidden>·</span>}
                        {cap && <CapabilityList cap={cap} />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lastFailedNewer ? (
                          <span className="text-destructive">
                            Last post failed{" "}
                            {formatDistanceToNow(new Date(lastFailedAt), {
                              addSuffix: true,
                            })}
                            {lastError ? `: ${lastError}` : ""}
                          </span>
                        ) : lastPublishedAt ? (
                          `Last post ${formatDistanceToNow(new Date(lastPublishedAt), { addSuffix: true })}`
                        ) : (
                          "No posts from this account yet"
                        )}
                        {account.connectedBy && (
                          <>
                            {" · "}
                            {account.connectedBy.stillMember ? (
                              `Connected by ${account.connectedBy.name}`
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400">
                                Connected by {account.connectedBy.name}, who has left. Reconnect so it doesn't depend on them.
                              </span>
                            )}
                          </>
                        )}
                      </p>
                      {(defaults.hashtags || defaults.firstComment) && (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          {[defaults.hashtags && "Default hashtags", defaults.firstComment && "First comment"].filter(Boolean).join(" and ")} added to every
                          post
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", TONE[h.tone].text)} title={h.detail}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", TONE[h.tone].dot)} aria-hidden />
                      {h.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {(h.tone !== "ok" || (account.connectedBy && !account.connectedBy.stillMember)) && (
                        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => connect(platform.id)} disabled={busy}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Reconnect
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Options for ${name}`}>
                            {checkingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          {account.connected && (
                            <DropdownMenuItem onClick={() => void runCheck(account, name)} disabled={checkingId === account.id}>
                              <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Check connection
                            </DropdownMenuItem>
                          )}
                          {account.connected && (
                            <DropdownMenuItem
                              onClick={() =>
                                setDefaultsFor({
                                  account,
                                  hashtags: defaults.hashtags ?? "",
                                  firstComment: defaults.firstComment ?? "",
                                })
                              }
                            >
                              <Hash className="mr-2 h-3.5 w-3.5" /> Post defaults
                            </DropdownMenuItem>
                          )}
                          {account.connected && siblings.length > 1 && !isDefault && (
                            <DropdownMenuItem onClick={() => void makeDefault(account, name)}>
                              <Star className="mr-2 h-3.5 w-3.5" /> Make default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => connect(platform.id)} disabled={busy} className="flex-col items-start gap-0.5">
                            <span className="flex items-center gap-2">
                              <RefreshCw className="h-3.5 w-3.5" /> Reconnect
                            </span>
                            <span className="pl-5 text-[11px] text-muted-foreground">Renews access and picks up new permissions</span>
                          </DropdownMenuItem>
                          {account.connected && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => void confirmDisconnect(account, name)} className="text-destructive focus:text-destructive">
                                <Unplug className="mr-2 h-3.5 w-3.5" /> Disconnect
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {platform.id === "twitter" && account.connected && twitterWebhook && (
                    <details className="w-full text-xs text-muted-foreground sm:basis-full">
                      <summary className="cursor-pointer select-none hover:text-foreground">Developer details</summary>
                      <p className="mt-2">Register this Account Activity webhook ({twitterWebhook.webhookEnv}) in the X Developer Portal:</p>
                      <code className="mt-1 block break-all rounded-md bg-muted px-2 py-1 text-[11px]">{twitterWebhook.webhookUrl}</code>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3" id="tour-connections-list">
        <h2 className="text-sm font-semibold">{rows.length ? "Add an account" : "Connect your first channel"}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {available.map((platform) => {
            const Icon = platform.icon;
            const cap = capabilityOf(platform.id);
            const comingSoon = cap?.status === "coming_soon";
            const busy = connectingOAuth === platform.id;
            const already = Boolean(getAccount(platform.id));
            return (
              <li key={platform.id} className={cn("flex flex-col rounded-2xl border bg-card p-5", comingSoon && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", platform.bgColor)}>
                    <Icon className={cn("h-5 w-5", platform.color)} />
                  </span>
                  {comingSoon && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Coming soon</span>}
                  {already && !comingSoon && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Connected</span>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{platform.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{platform.description}</p>
                {platform.id === "whatsapp" && !already && getAccount("facebook") && (
                  <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">Facebook is connected, so this may not need a new Meta login.</p>
                )}
                {cap && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    <CapabilityList cap={cap} />
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
                  <Button
                    size="sm"
                    variant={already ? "outline" : "default"}
                    className="h-8 gap-1.5 text-xs"
                    disabled={comingSoon || !tenant || !activeWorkspace || busy || loadingAccounts}
                    onClick={() => (platform.oauth || platform.id === "telegram" ? connect(platform.id) : setConnectDialog(platform.id))}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : already ? <Plus className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                    {busy ? "Opening…" : comingSoon ? "Not yet available" : already ? "Add another" : "Connect"}
                  </Button>
                  {platform.manualFallback && !comingSoon && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => setConnectDialog(platform.id)}
                    >
                      <KeyRound className="h-3 w-3" /> Use credentials instead
                    </button>
                  )}
                  {(platform.id === "instagram" || platform.id === "linkedin") && (
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                      disabled={!tenant || !activeWorkspace || Boolean(connectingOAuth)}
                      onClick={() => void startOAuthConnect(platform.id === "instagram" ? "instagram_login" : "linkedin_page")}
                    >
                      {platform.id === "instagram" ? "No Facebook Page? Connect with Instagram" : "Add a company Page"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet open={!!defaultsFor} onOpenChange={(open) => !open && setDefaultsFor(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Post defaults</SheetTitle>
          </SheetHeader>
          {defaultsFor && (
            <div className="mt-4 space-y-5">
              <p className="text-sm text-muted-foreground">
                Added to every post from <span className="font-medium text-foreground">{defaultsFor.account.accountName || defaultsFor.account.platform}</span>,
                so you don't have to set them each time.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="default-hashtags">Hashtags</Label>
                <Input
                  id="default-hashtags"
                  value={defaultsFor.hashtags}
                  onChange={(e) => setDefaultsFor({ ...defaultsFor, hashtags: e.target.value })}
                  placeholder="#coffee #lusaka"
                  maxLength={500}
                />
                <p className="text-[11px] text-muted-foreground">Added at the end of each post, skipping any it already has. On X, only what fits.</p>
              </div>
              {["facebook", "instagram"].includes(defaultsFor.account.platform) && (
                <div className="space-y-1.5">
                  <Label htmlFor="default-comment">First comment</Label>
                  <Textarea
                    id="default-comment"
                    rows={4}
                    value={defaultsFor.firstComment}
                    onChange={(e) =>
                      setDefaultsFor({
                        ...defaultsFor,
                        firstComment: e.target.value,
                      })
                    }
                    placeholder="Order online: link in bio"
                    maxLength={2000}
                  />
                  <p className="text-[11px] text-muted-foreground">Posted as a comment right after each post goes live. Handy for links and extra hashtags.</p>
                </div>
              )}
              <Button onClick={() => void saveDefaults()} disabled={savingDefaults} className="w-full">
                {savingDefaults && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save defaults
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={telegramOpen} onOpenChange={(open) => !connectingTelegram && setTelegramOpen(open)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Connect Telegram</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                In Telegram, message <span className="font-medium text-foreground">@BotFather</span>, send <code>/newbot</code> and copy the token it gives you.
              </li>
              <li>Add your bot to your channel as an admin who can post messages. For a group, just add it as a member.</li>
              <li>Paste the token and your channel's @username below.</li>
            </ol>
            <div className="space-y-1.5">
              <Label htmlFor="tg-token">Bot token</Label>
              <Input
                id="tg-token"
                type="password"
                autoComplete="off"
                value={telegramForm.botToken}
                onChange={(e) => setTelegramForm({ ...telegramForm, botToken: e.target.value })}
                placeholder="123456789:AA..."
              />
              <p className="text-[11px] text-muted-foreground">Stored encrypted and never shown again.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg-chat">Channel or group</Label>
              <Input
                id="tg-chat"
                value={telegramForm.chat}
                onChange={(e) => setTelegramForm({ ...telegramForm, chat: e.target.value })}
                placeholder="@yourchannel or -100…"
              />
              <p className="text-[11px] text-muted-foreground">Private channels and groups have no @username: use the chat ID instead.</p>
            </div>
            <Button
              onClick={() => void connectTelegram()}
              disabled={connectingTelegram || !telegramForm.botToken.trim() || !telegramForm.chat.trim()}
              className="w-full"
            >
              {connectingTelegram && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check and connect
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!channelSetup} onOpenChange={(open) => !open && !finalizingChannel && setChannelSetup(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">{channelSetup?.title || "Choose where to post"}</SheetTitle>
          </SheetHeader>
          {!channelSetup?.choices ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your options…
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <ul className="space-y-2" role="radiogroup">
                {channelSetup.choices.map((choice) => {
                  const selected = channelSetup.picked === choice.id;
                  return (
                    <li key={choice.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setChannelSetup({
                            ...channelSetup,
                            picked: choice.id,
                          })
                        }
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                          selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <span className="block text-sm font-medium">{choice.name}</span>
                        {choice.subtitle && <span className="block text-xs text-muted-foreground">{choice.subtitle}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button onClick={() => void finalizeChannel()} disabled={finalizingChannel || !channelSetup.picked} className="w-full">
                {finalizingChannel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <details className="rounded-2xl border bg-card/60 px-5 py-4 text-sm">
        <summary className="cursor-pointer select-none font-medium">How connecting works</summary>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li>You sign in to each network and approve access. Mako never sees your password.</li>
          <li>Accounts belong to the workspace you're in, so each brand or client keeps its own.</li>
          <li>If a network adds new permissions, or access expires, use Reconnect. Your posts and settings stay.</li>
          <li className="text-xs">
            For developers: each network's OAuth callback is{" "}
            <code className="rounded bg-muted px-1 text-[11px]">/api/v1/social-accounts/oauth/&#123;platform&#125;/callback</code>
          </li>
        </ul>
      </details>

      <Sheet
        open={
          !!connectDialog &&
          Boolean(activePlatform?.fields?.length) &&
          (!oauthPlatforms.includes(connectDialog as OAuthPlatform) || activePlatform?.manualFallback)
        }
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
            <SheetTitle className="font-display">Connect {activePlatform?.name}</SheetTitle>
          </SheetHeader>
          {connectDialog && activePlatform?.fields && (
            <div className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                {connectDialog === "twitter"
                  ? "Advanced: paste OAuth 1.0a user tokens from the X Developer Portal if OAuth connect is unavailable."
                  : "Advanced: paste credentials from Meta Business Manager if OAuth is unavailable."}
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
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <Button onClick={() => handleManualConnect(connectDialog as ManualPlatform | "whatsapp")} disabled={saving || !tenant} className="w-full">
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
              <p className="text-sm text-destructive">No Pages found. Close and try connecting again with a Meta account that manages a Page.</p>
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
                      {page.category && <p className="text-xs text-muted-foreground mt-0.5">{page.category}</p>}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <Button onClick={handleFinalizeFacebook} disabled={finalizingFacebook || loadingFacebookSetup || !selectedFacebookPage} className="w-full">
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
              <p className="text-sm text-destructive">No channels found. Create a YouTube channel with this Google account, then connect again.</p>
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
                        {channel.customUrl && <p className="text-xs text-muted-foreground mt-0.5">@{channel.customUrl}</p>}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <Button onClick={handleFinalizeYoutube} disabled={finalizingYoutube || loadingYoutubeSetup || !selectedYoutubeChannel} className="w-full">
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
            <p className="text-sm text-muted-foreground">Select the WhatsApp Business phone number to use for this workspace.</p>

            {loadingWhatsappSetup ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading phone numbers…
              </div>
            ) : whatsappPhones.length === 0 ? (
              <p className="text-sm text-destructive">No phone numbers found. Close and try connecting again from Meta Business Settings.</p>
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
                        <span className="font-medium text-sm">{phone.displayPhoneNumber || phone.verifiedName || phone.id}</span>
                      </div>
                      {phone.verifiedName && phone.displayPhoneNumber && <p className="text-xs text-muted-foreground mt-0.5">{phone.verifiedName}</p>}
                      {phone.wabaName && <p className="text-xs text-muted-foreground mt-0.5">WABA: {phone.wabaName}</p>}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}

            <Button onClick={handleFinalizeWhatsapp} disabled={finalizingWhatsapp || loadingWhatsappSetup || !selectedWhatsappPhone} className="w-full">
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
                To use this feature, you need to switch your Instagram account to a <strong>Creator</strong> or <strong>Business</strong> account and link it to
                a Facebook Page.
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-md text-sm">
                <strong>⚠️ Important:</strong> This will make your account public and automatically accept all pending follow requests. Your username,
                followers, and existing posts will remain the same.
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
              className=""
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
