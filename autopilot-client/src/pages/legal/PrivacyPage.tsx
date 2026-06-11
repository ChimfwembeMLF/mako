import { LegalLayout } from './LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Tekrem Innovation Solutions - Mako respects your privacy. This policy explains what we collect, why, and your choices.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account details (email, name) when you register</li>
        <li>Brand profile, content, and media you create</li>
        <li>OAuth tokens when you connect Facebook, Instagram, LinkedIn, YouTube, TikTok, or WhatsApp</li>
        <li>WhatsApp message content and phone numbers when you use inbox and auto-reply</li>
        <li>Usage data for AI features and billing</li>
      </ul>
      <h2>How we use data</h2>
      <ul>
        <li>Content generation, scheduling, and publishing</li>
        <li>Syncing and replying to comments on your published posts</li>
        <li>Processing subscriptions</li>
      </ul>
      <h2>Third parties</h2>
      <p>
        We integrate with Meta (Facebook, Instagram, WhatsApp), LinkedIn, Google (YouTube), TikTok,
        Mistral AI, and payment providers. We do not sell personal data.
      </p>
      <h2>Deletion</h2>
      <p>
        See <a href="/data-deletion">Data Deletion Instructions</a> to remove your account and connected social data.
      </p>
    </LegalLayout>
  );
}
