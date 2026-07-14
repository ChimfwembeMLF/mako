import React, { useEffect, useState, useCallback } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, Target, DollarSign, Activity, Pause, Play, BarChart3 } from 'lucide-react';
import { CreateCampaignSheet } from './CreateCampaignSheet';
import { adsApi, paymentsApi } from '../lib/api';
import { MobileMoneyPaymentForm } from '@/components/MobileMoneyPaymentForm';
import { createDefaultMobileMoneyPayment } from '@/lib/payment-countries';
import { useFxQuoteFromZmw, useFxQuoteToZmw } from '@/hooks/useFxQuote';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTenant } from '../hooks/useTenant';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEFAULT_ADS_TOPUP_ZMW = 500;

interface AdCreative {
  headline: string;
  body: string;
}

interface AdCampaign {
  id: string;
  name: string;
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'PINTEREST' | 'TABOOLA' | 'X' | 'EMBED';
  dailyBudget: number;
  status: string;
  platformCampaignId?: string;
  creative?: AdCreative | null;
}

export default function AdsPage() {
  const { activeWorkspace } = useWorkspace();
  const { tenant } = useTenant();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [stats, setStats] = useState({ activeCampaigns: 0, totalSpend: 0, totalImpressions: 0 });
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(500);
  const [topUpPayment, setTopUpPayment] = useState(createDefaultMobileMoneyPayment);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const { quote: topUpFxToZmw, loading: topUpFxLoading } = useFxQuoteToZmw(
    topUpAmount,
    topUpPayment.currency,
  );

  useEffect(() => {
    if (!isTopUpOpen) return;
    if (topUpPayment.currency === 'ZMW') {
      setTopUpAmount(DEFAULT_ADS_TOPUP_ZMW);
      return;
    }
    paymentsApi
      .fxQuoteFromZmw(DEFAULT_ADS_TOPUP_ZMW, topUpPayment.currency)
      .then((quote) => setTopUpAmount(Number(quote.amount)))
      .catch(() => setTopUpAmount(DEFAULT_ADS_TOPUP_ZMW));
  }, [isTopUpOpen, topUpPayment.currency]);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [bal, list, dash] = await Promise.all([
        adsApi.getBalance(tenant.id),
        adsApi.getCampaigns(tenant.id),
        adsApi.getDashboardStats(tenant.id),
      ]);
      setBalance(bal.balance);
      setCampaigns(list);
      setStats(dash);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTopUpSubmit = async () => {
    if (!activeWorkspace) {
      setAlertMessage('Error: Workspace not found.');
      return;
    }
    if (!topUpAmount || topUpAmount <= 0) {
      setAlertMessage('Please enter a valid amount greater than 0.');
      return;
    }
    if (!topUpPayment.phone.trim()) {
      setAlertMessage('Please enter your Mobile Money Number.');
      return;
    }
    setIsToppingUp(true);
    try {
      const res = await paymentsApi.initiateAdsDeposit({
        tenantId: tenant!.id,
        amount: topUpAmount,
        phone: topUpPayment.phone.trim(),
        correspondent: topUpPayment.correspondent,
        paymentCountryId: topUpPayment.paymentCountryId,
        currency: topUpPayment.currency,
        countryCode: topUpPayment.countryCode,
      });
      setAlertMessage(res.message);
      if (res.activated) {
        const bal = await adsApi.getBalance(tenant!.id);
        setBalance(bal.balance);
      }
      setIsTopUpOpen(false);
    } catch (err: any) {
      setAlertMessage(`Error: ${err.message}`);
      setIsTopUpOpen(false);
    } finally {
      setIsToppingUp(false);
    }
  };

  const handlePublish = async (campaignId: string) => {
    if (!tenant) return;
    setActionId(campaignId);
    try {
      await adsApi.publishCampaign(tenant.id, campaignId);
      setAlertMessage('Campaign published successfully.');
      await loadData();
    } catch (err: any) {
      setAlertMessage(err.message || 'Failed to publish campaign');
    } finally {
      setActionId(null);
    }
  };

  const handlePause = async (campaignId: string) => {
    if (!tenant) return;
    setActionId(campaignId);
    try {
      await adsApi.pauseCampaign(tenant.id, campaignId);
      setAlertMessage('Campaign paused.');
      await loadData();
    } catch (err: any) {
      setAlertMessage(err.message || 'Failed to pause campaign');
    } finally {
      setActionId(null);
    }
  };

  const handleMetrics = async (campaignId: string) => {
    if (!tenant) return;
    setActionId(campaignId);
    try {
      const metrics = await adsApi.getMetrics(tenant.id, campaignId);
      setAlertMessage(
        `Spend: ${metrics.spend.toFixed(2)} ZMW • Impressions: ${metrics.impressions} • Clicks: ${metrics.clicks}`,
      );
    } catch (err: any) {
      setAlertMessage(err.message || 'Failed to load metrics');
    } finally {
      setActionId(null);
    }
  };

  const handleCopyEmbed = async (campaignId: string) => {
    if (!tenant) return;
    try {
      const { snippet } = await adsApi.getEmbedScript(tenant.id, campaignId);
      await navigator.clipboard.writeText(snippet);
      setAlertMessage('Embed code copied to clipboard!');
    } catch (err: any) {
      setAlertMessage(err.message || 'Failed to get embed script');
    }
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Ad Campaigns
          </h1>
          <p className="text-gray-500 mt-2">Manage and track your AI-generated ad campaigns.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-md shadow-sm border flex flex-col items-end">
            <span className="text-xs text-gray-500 font-medium">Ads Balance</span>
            <span className="font-bold text-lg text-emerald-600">{balance.toFixed(2)} ZMW</span>
          </div>
          <Button variant="outline" className="shadow-sm" onClick={() => setIsTopUpOpen(true)}>
            <DollarSign className="w-4 h-4 mr-2" />
            Top Up
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Campaigns</p>
                <h3 className="text-2xl font-bold mt-1">{stats.activeCampaigns}</h3>
              </div>
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                <Target className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Spend</p>
                <h3 className="text-2xl font-bold mt-1">{stats.totalSpend.toFixed(2)} ZMW</h3>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Impressions</p>
                <h3 className="text-2xl font-bold mt-1">{stats.totalImpressions.toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No campaigns yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm">
                Use our AI to generate high-converting ad copy and launch it to Facebook, Google, or your website.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                Create your first campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => (
                <div key={c.id} className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-semibold">{c.name}</h4>
                    <p className="text-sm text-gray-500">
                      Platform: {c.platform} • Budget: {Number(c.dailyBudget).toFixed(2)} ZMW/day
                    </p>
                    {c.creative && (
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {c.creative.headline} — {c.creative.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.status === 'DRAFT' || c.status === 'FAILED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === c.id}
                        onClick={() => handlePublish(c.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {c.status === 'FAILED' ? 'Retry' : 'Publish'}
                      </Button>
                    ) : null}
                    {c.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === c.id}
                        onClick={() => handlePause(c.id)}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                    )}
                    {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === c.id}
                        onClick={() => handleMetrics(c.id)}
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        Metrics
                      </Button>
                    )}
                    {c.platform === 'EMBED' && c.platformCampaignId && c.status === 'ACTIVE' && (
                      <Button size="sm" variant="outline" onClick={() => handleCopyEmbed(c.id)}>
                        Copy Embed Code
                      </Button>
                    )}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        c.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : c.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCampaignSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={loadData}
      />

      <Dialog
        open={isTopUpOpen}
        onOpenChange={(open) => {
          setIsTopUpOpen(open);
          if (open) setTopUpPayment(createDefaultMobileMoneyPayment());
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Top Up Ads Balance</DialogTitle>
            <DialogDescription>
              Enter the amount you would like to deposit to your ads balance. You will receive a mobile money prompt.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount to pay ({topUpPayment.currency})
              </label>
              <input
                type="number"
                min="1"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                className="w-full border rounded-md p-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ads balance is kept in ZMW.{' '}
                {topUpFxLoading
                  ? 'Calculating ZMW credit…'
                  : topUpFxToZmw
                    ? `Adds ≈ ZMW ${Number(topUpFxToZmw.amountZmw).toLocaleString(undefined, { maximumFractionDigits: 2 })} to your balance.`
                    : 'Enter an amount to see the ZMW credit.'}
              </p>
            </div>
            <MobileMoneyPaymentForm
              value={topUpPayment}
              onChange={setTopUpPayment}
              disabled={isToppingUp}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTopUpOpen(false)} disabled={isToppingUp}>
              Cancel
            </Button>
            <Button onClick={handleTopUpSubmit} disabled={isToppingUp} className="bg-emerald-600 hover:bg-emerald-700">
              {isToppingUp ? 'Processing...' : 'Confirm Top Up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!alertMessage} onOpenChange={() => setAlertMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notification</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertMessage(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
