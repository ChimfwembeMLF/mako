import { Link } from 'react-router-dom';
import {
  Database, Share2, Sparkles, Trash2, UserCircle, MessageSquare, BarChart3,
} from 'lucide-react';
import { LegalCallout, LegalLayout, LegalSection } from './LegalLayout';

const COLLECT_ITEMS = [
  { icon: UserCircle, text: 'Account details (email, name) when you register' },
  { icon: Sparkles, text: 'Brand profile, content, and media you create' },
  { icon: Share2, text: 'OAuth tokens when you connect Facebook, Instagram, LinkedIn, YouTube, TikTok, or WhatsApp' },
  { icon: MessageSquare, text: 'WhatsApp message content and phone numbers when you use inbox and auto-reply' },
  { icon: BarChart3, text: 'Usage data for AI features and billing' },
];

const USE_ITEMS = [
  'Content generation, scheduling, and publishing',
  'Syncing and replying to comments on your published posts',
  'Processing subscriptions and plan limits',
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="How Tekrem Innovation Solutions — Mako collects, uses, and protects your data when you use our AI marketing platform."
      icon={Database}
    >
      <LegalCallout variant="accent">
        We respect your privacy. This policy explains what we collect, why we need it, and the choices you have.
      </LegalCallout>

      <LegalSection icon={Database} title="Information we collect">
        <ul className="space-y-3">
          {COLLECT_ITEMS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection icon={Sparkles} title="How we use data">
        <ul className="list-disc space-y-2 pl-5 marker:text-primary/60">
          {USE_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection icon={Share2} title="Third parties">
        <p>
          We integrate with Meta (Facebook, Instagram, WhatsApp), LinkedIn, Google (YouTube), TikTok,
          Mistral AI, and payment providers to deliver publishing, analytics, and billing features.
        </p>
        <LegalCallout>We do not sell your personal data to advertisers or data brokers.</LegalCallout>
      </LegalSection>

      <LegalSection icon={Trash2} title="Deletion & your rights">
        <p>
          You can request removal of your account and connected social data at any time. Visit our{' '}
          <Link to="/data-deletion" className="font-medium text-primary hover:underline">
            Data Deletion Instructions
          </Link>{' '}
          to submit a request or check status with your confirmation code.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
