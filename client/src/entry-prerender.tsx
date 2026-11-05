/**
 * Build-time renderer for public pages that crawlers must be able to read
 * without running JavaScript (Meta, Google and TikTok reviewers check these).
 * Used only by scripts/prerender.mjs; never shipped to the browser.
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import PrivacyPage from './pages/legal/PrivacyPage';
import TermsPage from './pages/legal/TermsPage';
import DataDeletionPage from './pages/legal/DataDeletionPage';
import { COMPANY, COMPANY_BYLINE } from './config/company';

export type PrerenderedPage = {
  route: string;
  title: string;
  description: string;
  html: string;
};

const PAGES = [
  {
    route: '/privacy',
    title: `Privacy Policy — ${COMPANY_BYLINE}`,
    description: `How ${COMPANY.legalName} collects, uses and protects data in ${COMPANY.productName}.`,
    Component: PrivacyPage,
  },
  {
    route: '/terms',
    title: `Terms of Service — ${COMPANY_BYLINE}`,
    description: `Terms for using ${COMPANY.productName}, operated by ${COMPANY.legalName}.`,
    Component: TermsPage,
  },
  {
    route: '/data-deletion',
    title: `Data Deletion Instructions — ${COMPANY_BYLINE}`,
    description: `How to delete your ${COMPANY.productName} account and connected data.`,
    Component: DataDeletionPage,
  },
] as const;

/**
 * Plain-HTML summary placed inside #root of the home page. Crawlers read it;
 * React replaces it as soon as the app mounts, so visitors never see it.
 */
function HomeSummary() {
  const contact = [COMPANY.address, COMPANY.phone, COMPANY.supportEmail].filter(Boolean);
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{COMPANY.productName}: social media management for African businesses</h1>
      <p>
        {COMPANY.productName} helps small and medium businesses plan content, publish to their own
        Facebook Page and Instagram account, reply to comments and messages from one inbox, message
        customers on WhatsApp and run ad campaigns.
      </p>
      <p>
        {COMPANY.productName} is a product of {COMPANY.legalName}, {COMPANY.country}.
      </p>
      <p>Contact: {contact.join(' · ')}</p>
      <p>
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> ·{' '}
        <a href="/data-deletion">Data Deletion Instructions</a> · <a href="/auth">Sign in</a>
      </p>
      <p>
        © {new Date().getFullYear()} {COMPANY_BYLINE}
      </p>
    </main>
  );
}

export function renderHome(): string {
  return renderToString(<HomeSummary />);
}

export function renderPages(): PrerenderedPage[] {
  return PAGES.map(({ route, title, description, Component }) => ({
    route,
    title,
    description,
    html: renderToString(
      <StaticRouter location={route}>
        <Component />
      </StaticRouter>,
    ),
  }));
}
