import React, { useEffect, useState } from 'react';
import { systemSettingsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Field, FormInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Save } from 'lucide-react';

const INTEGRATION_GROUPS = [
  {
    name: 'AI Models',
    fields: [
      { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', placeholder: 'sk-...' },
      { key: 'MISTRAL_API_KEY', label: 'Mistral API Key', placeholder: '...' },
      { key: 'GEMINI_API_KEY', label: 'Gemini API Key', placeholder: '...' },
      { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', placeholder: '...' },
    ],
  },
  {
    name: 'Google',
    fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', placeholder: '...' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', placeholder: '...' },
    ],
  },
  {
    name: 'Meta / Facebook / Instagram / WhatsApp',
    fields: [
      { key: 'FACEBOOK_APP_ID', label: 'Facebook App ID', placeholder: '...' },
      { key: 'FACEBOOK_APP_SECRET', label: 'Facebook App Secret', placeholder: '...' },
      { key: 'INSTAGRAM_CLIENT_ID', label: 'Instagram Client ID', placeholder: '...' },
      { key: 'INSTAGRAM_CLIENT_SECRET', label: 'Instagram Client Secret', placeholder: '...' },
      { key: 'META_WEBHOOK_VERIFY_TOKEN', label: 'Meta Webhook Verify Token', placeholder: '...' },
      { key: 'WHATSAPP_PLATFORM_PHONE_NUMBER_ID', label: 'WhatsApp Phone Number ID', placeholder: '...' },
      { key: 'WHATSAPP_PLATFORM_ACCESS_TOKEN', label: 'WhatsApp Access Token', placeholder: '...' },
      { key: 'WHATSAPP_PLATFORM_WABA_ID', label: 'WhatsApp Business Account ID', placeholder: '...' },
    ],
  },
  {
    name: 'X / Twitter',
    fields: [
      { key: 'TWITTER_CLIENT_ID', label: 'Twitter Client ID', placeholder: '...' },
      { key: 'TWITTER_CLIENT_SECRET', label: 'Twitter Client Secret', placeholder: '...' },
      { key: 'TWITTER_BEARER_TOKEN', label: 'Twitter Bearer Token', placeholder: '...' },
      { key: 'TWITTER_CONSUMER_KEY', label: 'Twitter Consumer Key (OAuth 1.0a)', placeholder: '...' },
      { key: 'TWITTER_CONSUMER_SECRET', label: 'Twitter Consumer Secret (OAuth 1.0a)', placeholder: '...' },
    ],
  },
  {
    name: 'LinkedIn',
    fields: [
      { key: 'LINKEDIN_CLIENT_ID', label: 'LinkedIn Client ID', placeholder: '...' },
      { key: 'LINKEDIN_CLIENT_SECRET', label: 'LinkedIn Client Secret', placeholder: '...' },
    ],
  },
  {
    name: 'TikTok',
    fields: [
      { key: 'TIKTOK_CLIENT_KEY', label: 'TikTok Client Key', placeholder: '...' },
      { key: 'TIKTOK_CLIENT_SECRET', label: 'TikTok Client Secret', placeholder: '...' },
    ],
  },
  {
    name: 'Ads (Marketing)',
    fields: [
      { key: 'META_AD_ACCOUNT_ID', label: 'Meta Ad Account ID', placeholder: '...' },
      { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Google Ads Developer Token', placeholder: '...' },
      { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads Customer ID', placeholder: '...' },
      { key: 'TIKTOK_ADVERTISER_ID', label: 'TikTok Advertiser ID', placeholder: '...' },
      { key: 'LINKEDIN_AD_ACCOUNT_ID', label: 'LinkedIn Ad Account ID', placeholder: '...' },
      { key: 'PINTEREST_ADS_ACCESS_TOKEN', label: 'Pinterest Ads Access Token', placeholder: '...' },
      { key: 'PINTEREST_AD_ACCOUNT_ID', label: 'Pinterest Ad Account ID', placeholder: '...' },
      { key: 'TABOOLA_CLIENT_ID', label: 'Taboola Client ID', placeholder: '...' },
      { key: 'TABOOLA_CLIENT_SECRET', label: 'Taboola Client Secret', placeholder: '...' },
      { key: 'TABOOLA_ACCOUNT_ID', label: 'Taboola Account ID', placeholder: '...' },
      { key: 'X_ADS_ACCOUNT_ID', label: 'X Ads Account ID', placeholder: '...' },
      { key: 'X_ADS_ACCESS_TOKEN', label: 'X Ads Access Token', placeholder: '...' },
    ],
  },
  {
    name: 'Storage (S3 / Supabase)',
    fields: [
      { key: 'AWS_ACCESS_KEY_ID', label: 'AWS Access Key ID', placeholder: '...' },
      { key: 'AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Access Key', placeholder: '...' },
      { key: 'AWS_S3_ENDPOINT', label: 'AWS S3 Endpoint', placeholder: '...' },
      { key: 'AWS_S3_BUCKET_NAME', label: 'AWS S3 Bucket Name', placeholder: '...' },
      { key: 'SUPABASE_URL', label: 'Supabase URL', placeholder: '...' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Service Role Key', placeholder: '...' },
    ],
  },
  {
    name: 'Payments (PawaPay)',
    fields: [
      { key: 'PAWAPAY_API_TOKEN', label: 'PawaPay API Token', placeholder: '...' },
      { key: 'PAWAPAY_PRIVATE_KEY', label: 'PawaPay Private Key', placeholder: '...' },
      { key: 'PAWAPAY_PUBLIC_KEY_ID', label: 'PawaPay Public Key ID', placeholder: '...' },
    ],
  },
  {
    name: 'Mail',
    fields: [
      { key: 'MAIL_USERNAME', label: 'Mail Username (SMTP)', placeholder: '...' },
      { key: 'MAIL_PASSWORD', label: 'Mail Password (SMTP)', placeholder: '...' },
    ],
  },
];

export function PlatformIntegrationsForm() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    setLoading(true);
    try {
      const data = await systemSettingsApi.getIntegrations();
      setValues(data);
    } catch (err: any) {
      toast({ title: 'Failed to load integrations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function saveIntegrations() {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value !== '********') {
          updates[key] = value;
        }
      }

      await systemSettingsApi.updateIntegrations(updates);
      toast({ title: 'Integrations saved' });
      await loadIntegrations();
    } catch (err: any) {
      toast({ title: 'Failed to save integrations', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Global Integration Keys</h2>
        <p className="text-sm text-muted-foreground">Configure API keys for external services. These will override the local environment variables. Existing keys are masked (********).</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveIntegrations} disabled={saving} className="gap-1.5 h-10 rounded-lg">
          <Save className="h-4 w-4" /> Save Integrations
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {INTEGRATION_GROUPS.map((group) => (
          <Card key={group.name} className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {group.fields.map((field) => (
                <Field key={field.key} label={field.label}>
                  <FormInput
                    type={values[field.key] === '********' ? 'text' : 'password'}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </Field>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="flex justify-end mt-6">
        <Button onClick={saveIntegrations} disabled={saving} className="gap-1.5 h-10 rounded-lg">
          <Save className="h-4 w-4" /> Save Integrations
        </Button>
      </div>
    </div>
  );
}
