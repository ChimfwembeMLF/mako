import {
  FileText, Scale, CreditCard, CloudOff, ShieldCheck, MessageSquareWarning,
} from 'lucide-react';
import { LegalCallout, LegalLayout, LegalSection } from './LegalLayout';

const ACCEPTABLE_USE = [
  'Comply with Meta, LinkedIn, Google, TikTok, and applicable platform policies',
  'No spam, misleading claims, or automated engagement that violates platform rules',
  'You are responsible for all content published from your connected accounts',
  'WhatsApp messaging must follow Meta opt-in, template, and consent requirements',
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="The rules for using Mako  — our AI-powered content, publishing, and inbox automation platform."
      icon={FileText}
    >
      <LegalCallout variant="accent">
        By creating an account or using Tekrem Innovation Solutions — Mako, you agree to these terms.
      </LegalCallout>

      <LegalSection icon={Scale} title="Acceptable use">
        <ul className="space-y-3">
          {ACCEPTABLE_USE.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection icon={MessageSquareWarning} title="Your content">
        <p>
          You retain ownership of content you create. You grant us a limited license to process, store,
          and transmit that content solely to operate the service — including AI generation, scheduling,
          publishing to connected platforms, and WhatsApp inbox features.
        </p>
      </LegalSection>

      <LegalSection icon={CreditCard} title="Subscriptions">
        <p>
          Paid plans are billed monthly according to the plan selected in-app. Features and usage limits
          are defined by your active subscription tier. Failed payments may suspend access until resolved.
        </p>
      </LegalSection>

      <LegalSection icon={CloudOff} title="Availability">
        <p>
          Social platform APIs may change, rate-limit, or restrict access without notice. We strive for
          reliability but do not guarantee uninterrupted third-party integrations or specific posting outcomes.
        </p>
        <LegalCallout>
          Service may be updated or discontinued with reasonable notice where practicable. Continued use after
          material changes constitutes acceptance of updated terms.
        </LegalCallout>
      </LegalSection>
    </LegalLayout>
  );
}
