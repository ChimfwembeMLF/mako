import { LegalLayout } from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>By using Tekrem Innovation Solutions - Mako, you agree to these terms.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Comply with Meta, LinkedIn, Google, TikTok, and applicable platform policies</li>
        <li>No spam or misleading automated engagement</li>
        <li>You are responsible for content published from your connected accounts</li>
        <li>WhatsApp messaging must follow Meta opt-in and template rules</li>
      </ul>
      <h2>Subscriptions</h2>
      <p>Paid plans are billed according to the plan selected in-app.</p>
      <h2>Availability</h2>
      <p>
        Social APIs may change or restrict access. We do not guarantee uninterrupted third-party integrations.
      </p>
    </LegalLayout>
  );
}
