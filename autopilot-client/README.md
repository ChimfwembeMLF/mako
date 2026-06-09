# BrandPilot

BrandPilot is an AI-assisted marketing operations platform for SMEs. It combines brand context management, content generation, social publishing workflows, lead capture/qualification, and lightweight analytics in one dashboard.

## What this project does

- Centralizes a business profile (Brand Brain) for consistent AI output.
- Generates multi-channel marketing content with optional media assets.
- Schedules and publishes content to connected social platforms.
- Captures leads via webhook and embeddable contact forms.
- Classifies leads and supports AI-assisted response workflows.
- Provides dashboard analytics across content and lead activity.

## Tech stack

- Frontend: React 18 + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui + Radix
- Data/Auth/Storage/Functions: Supabase
- Data fetching and state: TanStack Query
- Rich text editing: TipTap
- Charts: Recharts
- Testing: Vitest + Testing Library

## Core modules and routes

Authenticated routes are nested under a protected dashboard layout.

- /: Dashboard overview
- /brand-brain: Brand profile and AI guardrails
- /content: Content generation and media attachment workflows
- /content/edit/:id: Edit generated content
- /scheduler: Scheduling, calendar view, and publishing actions
- /leads: Lead intake, classification, and email workflows
- /analytics: KPI cards and channel breakdown charts
- /publisher: Social account connection management
- /settings: Profile, notifications, and embed helpers

Public routes:

- /auth: Sign in, sign up, forgot password
- /reset-password: Password recovery completion
- /contact/:userId: Embeddable lead capture form

## Architecture overview

1. User authenticates via Supabase Auth.
2. Frontend reads/writes product data in Supabase tables.
3. Frontend invokes Supabase Edge Functions for AI and automation tasks.
4. Edge Functions use service role credentials + provider API keys to execute workflows.
5. Results are persisted into content/lead tables and rendered in module pages.

## Repository structure

- src/: Frontend application
- src/pages/: Feature pages and route-level UI
- src/components/: Shared and feature UI components
- src/hooks/: Auth and utility hooks
- src/integrations/supabase/: Generated client and database types
- supabase/functions/: Edge Functions
- supabase/migrations/: SQL migrations

## Data model (main tables)

Based on the generated Supabase types, the primary public tables are:

- brand_brains: Brand context, voice, audience, offers, and guardrails
- generated_content: Content artifacts, statuses, schedule metadata, media references
- leads: Lead submissions, AI classification, status, unsubscribe tracking
- profiles: User profile metadata
- social_accounts: Connected publishing account credentials and status
- content_media: Multi-attachment media records linked to generated content (via migration)

## Edge functions and responsibilities

- generate-content: Creates channel-specific text content from brand context
- generate-image: Generates a single visual asset for content
- generate-slideshow: Produces multiple slide assets
- repurpose-content: Rewrites a content item into other channel formats
- daily-content-workflow: Batch automation across configured systems/content types
- publish-content: Publishes approved content to connected channels
- lead-webhook: Ingests lead payloads and triggers AI-assisted processing
- send-lead-email: Sends outbound lead email via Resend
- notify: Notification payload handling (currently logs/returns success)
- unsubscribe: Processes email unsubscribe token requests

## Local development

### Prerequisites

- Node.js 18+
- npm (or Bun, but npm is the documented default)
- Supabase CLI

### 1) Install dependencies

```bash
npm install
```

### 2) Create frontend environment file

Create .env.local with:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_ref
```

Do not commit real keys.

### 3) Run frontend

```bash
npm run dev
```

Vite is configured for host :: on port 8080.

### 4) Optional checks

```bash
npm run lint
npm run test
npm run build
```

## Supabase setup and deployment

### Link CLI to the correct project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### Apply migrations

```bash
supabase db push
```

### Required function secrets

Set these in Supabase project secrets before deploying functions:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- LOVABLE_API_KEY
- MISTRAL_API_KEY
- RESEND_API_KEY

Example:

```bash
supabase secrets set LOVABLE_API_KEY=... MISTRAL_API_KEY=... RESEND_API_KEY=...
```

### Deploy functions

```bash
supabase functions deploy generate-content
supabase functions deploy generate-image
supabase functions deploy generate-slideshow
supabase functions deploy repurpose-content
supabase functions deploy daily-content-workflow
supabase functions deploy publish-content
supabase functions deploy lead-webhook
supabase functions deploy send-lead-email
supabase functions deploy notify
supabase functions deploy unsubscribe
```

## NPM scripts

- npm run dev: Start Vite dev server
- npm run build: Production build
- npm run build:dev: Development-mode build
- npm run preview: Preview production build locally
- npm run lint: Run ESLint
- npm run test: Run Vitest once
- npm run test:watch: Run Vitest in watch mode

## Authentication behavior

- Route protection is implemented in App route guards.
- Most app routes require an authenticated user.
- Public routes include auth, password recovery, and contact form submission.
- Google sign-in uses a development shortcut in src/integrations/lovable/index.ts when MODE is development.

## Project review summary (March 31, 2026)

Severity: Critical

- Sensitive credentials are currently present in .env and that file is not ignored by .gitignore.
- Risk: key leakage and account compromise (Supabase/API providers).
- Recommended fix: rotate exposed keys immediately, remove secrets from git history, add .env and .env.* to .gitignore, and commit a sanitized .env.example.

Severity: High

- Supabase project references appear inconsistent:
  - Frontend env points to one project ref.
  - supabase/config.toml points to a different project_id.
- Risk: local CLI operations and deployments may target a different backend than the frontend.
- Recommended fix: choose one canonical project ref and align all environment/config files.

Severity: Medium

- Several functions have verify_jwt = false in supabase/config.toml.
- Risk: endpoints can be publicly callable unless each function enforces auth internally.
- Recommended fix: enable JWT verification where possible and keep unauthenticated access only for intentionally public endpoints (for example, lead-webhook or unsubscribe) with additional request validation/rate limiting.

Severity: Medium

- Test coverage is currently minimal (single placeholder-style test).
- Risk: regressions in routing, auth guards, and feature workflows.
- Recommended fix: add module-level tests for Brand Brain saves, content generation flow, scheduler state transitions, and lead classification/email actions.

## Suggested next improvements

1. Add a .env.example and strict secret handling policy.
2. Add CI pipeline checks: lint + test + build.
3. Introduce API and function-level observability (structured logs and alerts).
4. Expand automated tests for critical workflows.

## License

This repository includes a LICENSE file at the project root.
