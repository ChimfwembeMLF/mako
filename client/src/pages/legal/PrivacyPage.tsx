import { Link } from 'react-router-dom';
import {
  Database, Share2, Sparkles, Trash2, UserCircle, MessageSquare, BarChart3,
  Facebook, Clock, Mail,
} from 'lucide-react';
import { LegalCallout, LegalLayout, LegalSection } from './LegalLayout';

const COLLECT_ITEMS = [
  { icon: UserCircle, text: 'Account details (email, name) when you register or sign in with a social provider' },
  { icon: Sparkles, text: 'Brand profile, content drafts, media, campaigns, and workspace settings you create' },
  { icon: Share2, text: 'OAuth access tokens and account identifiers when you connect Facebook, Instagram, LinkedIn, YouTube, TikTok, or WhatsApp' },
  { icon: MessageSquare, text: 'WhatsApp message content, contacts, and phone numbers when you use inbox, templates, or auto-reply' },
  { icon: Mail, text: 'Gmail messages and Google account data when you connect Google products, as described below' },
  { icon: BarChart3, text: 'Usage data for AI features, publishing activity, and billing' },
];

const META_ITEMS = [
  'Facebook Login profile data (name, email, Facebook user ID) when you use Facebook to sign in',
  'Facebook Page IDs, Page access tokens, and Page metadata for Pages you select in Connections',
  'Page posts, photos, videos, comments, and comment replies for publishing and Social Inbox',
  'Instagram Professional account IDs, profile metadata, published media, comments, and Direct messages for connected accounts',
  'Meta ad account IDs, campaign/ad set/ad objects, and performance metrics when you use Ads',
  'WhatsApp Business Account IDs, phone number IDs, message templates, and inbound/outbound message content',
  'Meta Business asset relationships needed to list Pages, ad accounts, and WhatsApp numbers you manage',
];

const GOOGLE_ITEMS = [
  'Google sign-in: your name, email address, and profile picture',
  'Gmail, if you connect it: messages in your inbox are read and stored in your workspace, including sender, subject, and body, so you can view them in Mako. Mako sends replies from your account, either ones you write or AI drafts when you turn on auto-reply',
  'Google Drive, if you connect it: we list your files so you can choose one, and copy only the files you import into your media library',
  'YouTube, if you connect it: channel details, videos you upload through Mako, comments, and performance data',
  'Google Ads, if you connect it: account, campaign, and performance data for the campaigns you manage in Mako',
];

const USE_ITEMS = [
  'Generate, schedule, and publish content to connected social accounts on your behalf',
  'Sync comments and messages into Social Inbox and send replies you approve',
  'Create, publish, pause, and measure Meta ad campaigns you configure in Ads',
  'Send and receive WhatsApp Business messages and templates for customer support and follow-up',
  'Process subscriptions, plan limits, and product analytics',
];

const RETENTION_ITEMS = [
  'OAuth tokens are stored encrypted and refreshed as needed while the account stays connected; disconnecting removes stored tokens for that connection',
  'Published content copies, inbox messages, and ad campaign records remain in your workspace until you delete them or request account deletion',
  'Data deletion requests are processed as described on our Data Deletion Instructions page; Meta-initiated deletion callbacks are honored via our registered callback',
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

      <LegalSection icon={Facebook} title="Meta (Facebook, Instagram, WhatsApp) data">
        <p className="mb-3">
          When you connect Meta products in Connections, or use Facebook Login, we access only the
          data needed for the features you use. Depending on the permissions you grant, that may include:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary/60">
          {META_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <LegalCallout className="mt-4">
          We do not use Meta Platform Data to build profiles of people who are not Mako users, and we do
          not sell Meta Platform Data to advertisers or data brokers.
        </LegalCallout>
      </LegalSection>

      <LegalSection icon={Mail} title="Google user data">
        <p className="mb-3">
          When you sign in with Google or connect a Google product, we access only the data needed for
          the features you choose to use. Depending on the permissions you grant, that may include:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary/60">
          {GOOGLE_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3">
          If you turn on Gmail auto-reply, the text of incoming messages is sent to the AI provider
          selected for your workspace to draft a reply. We use Google user data only to provide
          these user-facing features. We do not sell it, use it for advertising, or use it to train
          generalized AI or machine learning models.
        </p>
        <LegalCallout>
          Mako's use and transfer of information received from Google APIs to any other app will adhere
          to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </LegalCallout>
      </LegalSection>

      <LegalSection icon={Sparkles} title="How we use data">
        <ul className="list-disc space-y-2 pl-5 marker:text-primary/60">
          {USE_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection icon={Clock} title="Retention">
        <ul className="list-disc space-y-2 pl-5 marker:text-primary/60">
          {RETENTION_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection icon={Share2} title="Third parties">
        <p>
          We integrate with Meta (Facebook, Instagram, WhatsApp), LinkedIn, Google (Gmail, Drive,
          YouTube, Google Ads), TikTok, AI providers (Mistral AI by default, or OpenAI, Google Gemini, or
          DeepSeek if your workspace chooses them), and payment providers to deliver publishing, inbox,
          ads, analytics, AI, and billing features. Service providers process data only to provide those
          services under contract.
        </p>
        <LegalCallout>We do not sell your personal data to advertisers or data brokers.</LegalCallout>
      </LegalSection>

      <LegalSection icon={Trash2} title="Deletion & your rights">
        <p>
          You can disconnect connected accounts anytime in Mako, remove Mako from your Facebook settings
          or your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Google Account permissions
          </a>
          , or request removal of your account and connected data, including stored Gmail messages.
          Visit our{' '}
          <Link to="/data-deletion" className="font-medium text-primary hover:underline">
            Data Deletion Instructions
          </Link>{' '}
          to submit a request or check status with your confirmation code. Meta may also send a signed
          data-deletion callback, which we process automatically.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
