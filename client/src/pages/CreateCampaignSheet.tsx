import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Wand2, AlertTriangle } from 'lucide-react';
import { systemSettingsApi, adsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CampaignFormData {
  name: string;
  platform: string;
  dailyBudget: number;
  targetAudience: string;
  prompt: string;
  location: string;
  startDate: string;
  endDate: string;
  ageRange: string;
  targetUrl: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateCampaignSheet({ open, onOpenChange, onSuccess }: Props) {
  const { tenant } = useTenant();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [enabledAds, setEnabledAds] = useState<string[]>([
    'META',
    'GOOGLE',
    'TIKTOK',
    'LINKEDIN',
    'PINTEREST',
    'TABOOLA',
    'X',
    'EMBED',
  ]);
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    platform: 'META',
    dailyBudget: 10,
    targetAudience: '',
    prompt: '',
    location: '',
    startDate: '',
    endDate: '',
    ageRange: '',
    targetUrl: '',
  });

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  useEffect(() => {
    systemSettingsApi
      .findOne('enabled_ad_platforms')
      .then((d) => {
        if (d?.value?.platforms) setEnabledAds(d.value.platforms);
      })
      .catch(() => {});
  }, []);

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleAiAssist = async () => {
    if (!aiPrompt || !tenant) return;
    setIsAiGenerating(true);
    setError(null);
    try {
      const res = await adsApi.generateCampaignAssist(
        tenant.id,
        aiPrompt,
        formData.platform,
      );
      setFormData((prev) => ({
        ...prev,
        name: res.name || prev.name,
        targetAudience: res.targetAudience || prev.targetAudience,
        prompt: res.prompt || prev.prompt,
        location: res.location || prev.location,
        ageRange: res.ageRange || prev.ageRange,
      }));
      setAiPrompt('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate campaign details');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!tenant) {
      setError('Workspace not found.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await adsApi.createCampaign(tenant.id, formData);
      setAlertMessage('Campaign created and launched successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDuration = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate).getTime();
      const end = new Date(formData.endDate).getTime();
      return Math.max(1, Math.ceil((end - start) / (1000 * 3600 * 24)));
    }
    return 1;
  };

  const totalCost =
    formData.platform === 'EMBED' ? 0 : formData.dailyBudget * getDuration();

  const closeSuccess = () => {
    setAlertMessage(null);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto w-full">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold">Create Campaign</SheetTitle>
        </SheetHeader>

        <div className="pt-2">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-100 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">AI Campaign Assist</h3>
                </div>
                <p className="text-sm text-purple-700 mb-3">
                  Describe what you want to promote, and let AI fill out the campaign details for you.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border-purple-200 rounded-md p-2 text-sm bg-white"
                    placeholder="e.g. A 3-day flash sale for my new running shoes in Lusaka..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiAssist()}
                  />
                  <Button
                    onClick={handleAiAssist}
                    disabled={isAiGenerating || !aiPrompt}
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                  >
                    {isAiGenerating ? 'Thinking...' : 'Magic Fill'}
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Campaign Name</label>
                <input
                  type="text"
                  className="w-full border rounded-md p-2"
                  placeholder="E.g. Summer Sale 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Platform</label>
                <select
                  className="w-full border rounded-md p-2"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                >
                  {enabledAds.includes('META') && (
                    <option value="META">Facebook & Instagram</option>
                  )}
                  {enabledAds.includes('GOOGLE') && <option value="GOOGLE">Google Ads</option>}
                  {enabledAds.includes('TIKTOK') && <option value="TIKTOK">TikTok Ads</option>}
                  {enabledAds.includes('LINKEDIN') && (
                    <option value="LINKEDIN">LinkedIn Ads</option>
                  )}
                  {enabledAds.includes('PINTEREST') && (
                    <option value="PINTEREST">Pinterest Ads</option>
                  )}
                  {enabledAds.includes('TABOOLA') && (
                    <option value="TABOOLA">Taboola / Native Article</option>
                  )}
                  {enabledAds.includes('X') && <option value="X">X (Twitter) Ads</option>}
                  {enabledAds.includes('EMBED') && (
                    <option value="EMBED">Embed on Website (Self-Hosted)</option>
                  )}
                </select>
              </div>
              {formData.platform === 'EMBED' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Target URL (Where should the ad link to?)
                  </label>
                  <input
                    type="url"
                    className="w-full border rounded-md p-2"
                    placeholder="https://example.com/checkout"
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md p-2"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    className="w-full border rounded-md p-2"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleNext} className="w-full">
                Next: Audience & AI Prompt
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Location Targeting</label>
                  <input
                    type="text"
                    className="w-full border rounded-md p-2"
                    placeholder="E.g. Zambia, Lusaka, or Global"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age Range</label>
                  <input
                    type="text"
                    className="w-full border rounded-md p-2"
                    placeholder="E.g. 18-35 or 25-65+"
                    value={formData.ageRange}
                    onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Detailed Targeting / Interests</label>
                <input
                  type="text"
                  className="w-full border rounded-md p-2"
                  placeholder="E.g. 'Software engineers interested in AI'"
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({ ...formData, targetAudience: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI Instruction Prompt</label>
                <textarea
                  className="w-full border rounded-md p-2 h-24"
                  placeholder="Describe what the ad should be about."
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                />
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleNext} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600">
                  Next: Budget
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Daily Budget (ZMW)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded-md p-2"
                  value={formData.dailyBudget}
                  onChange={(e) =>
                    setFormData({ ...formData, dailyBudget: Number(e.target.value) })
                  }
                  disabled={formData.platform === 'EMBED'}
                />
                {formData.platform === 'EMBED' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Self-hosted embed ads are free — no balance charge.
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-md border">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Daily Budget</span>
                  <span className="font-semibold">{formData.dailyBudget.toFixed(2)} ZMW</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-semibold">{getDuration()} days</span>
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <span className="font-medium text-gray-900">Total Campaign Cost</span>
                  <span className="font-bold text-lg text-blue-600">
                    {totalCost.toFixed(2)} ZMW
                  </span>
                </div>
              </div>

              {formData.platform !== 'EMBED' && (
                <p className="text-sm text-gray-500">
                  Connect the matching account in Publisher Connect before launching. Balance is charged when the campaign goes live.
                </p>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-start text-sm">
                  <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={handleBack} className="flex-1" disabled={isSubmitting}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {isSubmitting ? 'Launching...' : 'Pay & Launch Campaign'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={!!alertMessage} onOpenChange={closeSuccess}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Success</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeSuccess}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
