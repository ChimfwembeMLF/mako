import React, { useEffect, useState } from 'react';
import { systemSettingsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Field, FormSection, FormRow, FormInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

const INTEGRATION_FIELDS = [
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', placeholder: 'sk-...' },
  { key: 'MISTRAL_API_KEY', label: 'Mistral API Key', placeholder: '...' },
  { key: 'GEMINI_API_KEY', label: 'Gemini API Key', placeholder: '...' },
  { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', placeholder: '...' },
  { key: 'GOOGLE_DRIVE_CLIENT_ID', label: 'Google Drive Client ID', placeholder: '...' },
  { key: 'GOOGLE_DRIVE_CLIENT_SECRET', label: 'Google Drive Client Secret', placeholder: '...' },
  { key: 'S3_ACCESS_KEY_ID', label: 'S3 Access Key ID', placeholder: '...' },
  { key: 'S3_SECRET_ACCESS_KEY', label: 'S3 Secret Access Key', placeholder: '...' },
  { key: 'GOOGLE_CLIENT_ID', label: 'Google Auth Client ID', placeholder: '...' },
  { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Auth Client Secret', placeholder: '...' },
  { key: 'META_CLIENT_ID', label: 'Meta Client ID', placeholder: '...' },
  { key: 'META_CLIENT_SECRET', label: 'Meta Client Secret', placeholder: '...' },
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
    <FormSection 
      title="Global Integration Keys" 
      description="Configure API keys for external services. These will override the local environment variables. Leave a field blank and save to remove the override and fall back to the environment variable. Existing keys are masked (********)."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATION_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            <FormInput
              type={values[field.key] === '********' ? 'text' : 'password'}
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <Button onClick={saveIntegrations} disabled={saving} className="gap-1.5 h-10 rounded-lg mt-4">
        <Save className="h-4 w-4" /> Save Integrations
      </Button>
    </FormSection>
  );
}
