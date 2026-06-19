import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings as SettingsIcon, User, Bell, Link2, Save, Loader2, LogOut, Facebook, Linkedin, Instagram, Twitter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { socialAccountsApi, notificationsApi, SocialAccount } from "@/lib/api";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  notification_preferences: { hot_leads: boolean; content_published: boolean } | null;
}

const platformIcons: Record<string, any> = {
  facebook: Facebook,
  linkedin: Linkedin,
  instagram: Instagram,
  twitter: Twitter,
};

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "X / Twitter",
};

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile>({ display_name: "", avatar_url: "", notification_preferences: null });
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [notifyHotLeads, setNotifyHotLeads] = useState(true);
  const [notifyPublished, setNotifyPublished] = useState(true);
  const [notifyBilling, setNotifyBilling] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        display_name: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : prev.display_name,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (tenant) {
      loadSocialAccounts();
      loadNotificationPrefs();
    }
  }, [tenant]);

  const loadNotificationPrefs = async () => {
    if (!tenant) return;
    setPrefsLoading(true);
    try {
      const prefs = await notificationsApi.getPreferences(tenant.id);
      setNotifyHotLeads(prefs.emailHotLeads);
      setNotifyPublished(prefs.emailPublishSuccess);
      setNotifyBilling(prefs.emailBilling);
      setNotifyWeekly(prefs.emailWeeklyDigest);
      setInAppEnabled(prefs.inAppEnabled);
    } catch {
      /* keep defaults */
    } finally {
      setPrefsLoading(false);
    }
  };

  const saveNotificationPrefs = async (patch: Partial<{
    emailHotLeads: boolean;
    emailPublishSuccess: boolean;
    emailBilling: boolean;
    emailWeeklyDigest: boolean;
    inAppEnabled: boolean;
  }>) => {
    if (!tenant) return;
    try {
      await notificationsApi.updatePreferences({ tenantId: tenant.id, ...patch });
    } catch (err: unknown) {
      toast({
        title: "Could not save preferences",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    }
  };

  const loadSocialAccounts = async () => {
    if (!tenant) return;
    try {
      const data = await socialAccountsApi.getMyAccounts();
      const list = Array.isArray(data) ? data : [];
      setSocialAccounts(list.filter((a: SocialAccount) => a.tenantId === tenant.id));
    } catch {
      setSocialAccounts([]);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      toast({ title: "Profile updated!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const disconnectAccount = async (id: string) => {
    try {
      await socialAccountsApi.disconnect(id);
      toast({ title: "Account disconnected" });
      loadSocialAccounts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to disconnect";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const connectedAccounts = socialAccounts.filter((a) => a.connected);

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your profile, notifications, and connections</p>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Connections
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Your Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={profile.display_name || ""}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="Your display name"
                  maxLength={100}
                />
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Sign Out</h3>
                  <p className="text-xs text-muted-foreground">Sign out of your account</p>
                </div>
                <Button variant="outline" className="text-destructive border-destructive/30" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">In-app notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Bell notifications</p>
                  <p className="text-xs text-muted-foreground">Show alerts in the navbar</p>
                </div>
                <Switch
                  checked={inAppEnabled}
                  disabled={prefsLoading}
                  onCheckedChange={(v) => {
                    setInAppEnabled(v);
                    void saveNotificationPrefs({ inAppEnabled: v });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Email notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Hot lead alerts</p>
                  <p className="text-xs text-muted-foreground">When AI classifies a lead as hot</p>
                </div>
                <Switch
                  checked={notifyHotLeads}
                  disabled={prefsLoading}
                  onCheckedChange={(v) => {
                    setNotifyHotLeads(v);
                    void saveNotificationPrefs({ emailHotLeads: v });
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Content published</p>
                  <p className="text-xs text-muted-foreground">After successful publish to social accounts</p>
                </div>
                <Switch
                  checked={notifyPublished}
                  disabled={prefsLoading}
                  onCheckedChange={(v) => {
                    setNotifyPublished(v);
                    void saveNotificationPrefs({ emailPublishSuccess: v });
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Billing & subscription</p>
                  <p className="text-xs text-muted-foreground">Payments and renewal reminders</p>
                </div>
                <Switch
                  checked={notifyBilling}
                  disabled={prefsLoading}
                  onCheckedChange={(v) => {
                    setNotifyBilling(v);
                    void saveNotificationPrefs({ emailBilling: v });
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Weekly content overview</p>
                  <p className="text-xs text-muted-foreground">Monday digest of posts, engagement, and leads</p>
                </div>
                <Switch
                  checked={notifyWeekly}
                  disabled={prefsLoading}
                  onCheckedChange={(v) => {
                    setNotifyWeekly(v);
                    void saveNotificationPrefs({ emailWeeklyDigest: v });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                Email notifications go to <strong>{user?.email}</strong>. In-app alerts appear in the bell icon in the navbar.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {connectedAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No accounts connected. Go to <a href="/publisher" className="text-primary hover:underline">Publisher Connect</a> to link your social accounts.
                </p>
              ) : (
                <div className="space-y-3">
                  {connectedAccounts.map((account) => {
                    const Icon = platformIcons[account.platform] || Link2;
                    return (
                      <div key={account.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{platformLabels[account.platform] || account.platform}</p>
                            {account.accountName && (
                              <p className="text-xs text-muted-foreground">{account.accountName}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Connected</Badge>
                          <Button size="sm" variant="ghost" className="text-destructive h-7 text-xs" onClick={() => disconnectAccount(account.id)}>
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-2">Lead Capture Embed Code</h3>
              <p className="text-xs text-muted-foreground mb-3">Copy this iframe snippet to embed your branded contact form on any website:</p>
              <div className="space-y-2">
                {(() => {
                  const url = `${window.location.origin}/contact/${user?.id}`;
                  const iframe = `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;max-width:480px;"></iframe>`;
                  return (
                    <div className="space-y-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-primary"
                        onClick={() => {
                          navigator.clipboard.writeText(iframe);
                          toast({ title: "Copied!", description: "Embed code copied to clipboard." });
                        }}
                      >
                        Copy Embed
                      </Button>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                        {iframe}
                      </pre>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="pt-8 mt-8 border-t text-sm text-muted-foreground flex flex-wrap gap-4">
        <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
        <Link to="/data-deletion" className="hover:text-foreground hover:underline">Data Deletion</Link>
      </footer>
    </div>
  );
};

export default SettingsPage;
