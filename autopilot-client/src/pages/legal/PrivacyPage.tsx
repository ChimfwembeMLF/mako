import { LegalLayout } from './LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Tekrem Innvation Solutions Autopilot respects your privacy. This policy explains what we collect, why, and your choices.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account details (email, name) when you register</li>
        <li>Brand profile and content you create</li>
        <li>Social account tokens when you connect Facebook, Instagram, or LinkedIn</li>
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
        We integrate with Meta, LinkedIn, Mistral AI, and payment providers. We do not sell personal data.
      </p>
      <h2>Deletion</h2>
      <p>
        See <a href="/data-deletion">Data Deletion Instructions</a> to remove your account and connected social data.
      </p>
    </LegalLayout>
  );
}
