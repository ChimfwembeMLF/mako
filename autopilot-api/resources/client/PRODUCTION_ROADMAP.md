# Mako — Production Engineering Roadmap

> **Purpose:** Granular, developer-executable backlog for transforming Mako from a prototype into a production-ready SaaS. Every task includes a Definition of Done (DoD). Tasks are ordered by dependency — complete them in sequence within each phase.
>
> **Reference audit:** All file paths, table names, and column names below match the current codebase as of the audit date.

---

## Table of Contents

1. [Phase 1 — Critical Security & Stability](#phase-1--critical-security--stability)
2. [Phase 2 — Architectural Scalability](#phase-2--architectural-scalability)
3. [Phase 3 — Core Feature Completion](#phase-3--core-feature-completion)
4. [Phase 4 — Monetization & Infrastructure](#phase-4--monetization--infrastructure)

---

## Phase 1 — Critical Security & Stability

> Must be completed before any new features are shipped or any external users are onboarded.

---

### 1.1 Fix RLS: Leads Table — Prevent Cross-User Injection

**Problem:** `supabase/migrations/20260308205721_b0198d84-a15e-409c-b714-d28e1c2b5d5a.sql` contains `CREATE POLICY "Public can insert leads" ON public.leads FOR INSERT TO anon WITH CHECK (true)`. The `user_id` field is supplied by the caller's request body, not derived from auth. Any anonymous caller knowing a target `user_id` (exposed in `/contact/:userId` URLs) can spam leads into any account.

**Tasks:**

- [ ] **SEC-001 — Add webhook secret validation to `lead-webhook`**
  - In `supabase/functions/lead-webhook/index.ts`, read a `X-Webhook-Secret` header from the incoming request.
  - Store a per-user webhook secret in a new column: `ALTER TABLE public.leads_sources ADD COLUMN webhook_secret TEXT DEFAULT gen_random_uuid()::text;` *(see SEC-003 for the new table)*.
  - Before inserting a lead, query the DB to confirm the provided secret matches the record for the supplied `user_id`. If it does not match, return HTTP 403.
  - **DoD:** A `curl` POST to the webhook endpoint with a valid `user_id` but no `X-Webhook-Secret` returns `403 Forbidden` and no row is inserted in `leads`.

- [ ] **SEC-002 — Add FK constraint on `leads.user_id`**
  - Create a new migration file in `supabase/migrations/` that runs:
    ```sql
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    ```
  - **DoD:** Attempting to insert a `leads` row with a non-existent `user_id` via Supabase Studio returns a FK violation error.

- [ ] **SEC-003 — Create `lead_sources` table to replace body-supplied `user_id`**
  - Create migration:
    ```sql
    CREATE TABLE public.lead_sources (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      label        TEXT NOT NULL DEFAULT 'Default',
      webhook_secret TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, label)
    );
    ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users manage own lead sources"
      ON public.lead_sources FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    ```
  - Update `supabase/functions/lead-webhook/index.ts`: remove `user_id` from the accepted request body. Instead, accept `source_id` + `X-Webhook-Secret`. Look up `lead_sources` by `(id, webhook_secret)` to resolve the `user_id`. Reject if not found.
  - Update `src/pages/LeadAgent.tsx`: display the webhook URL as `{supabaseUrl}/functions/v1/lead-webhook` with the `source_id` and secret shown to the user. Replace the current raw `user_id` exposure.
  - **DoD:** The webhook URL shown in the LeadAgent UI contains a `source_id`, not the user's `auth.uid()`. A POST with a wrong secret returns 403. A POST with the correct secret inserts a lead attributed to the correct user without `user_id` in the request body.

---

### 1.2 Fix RLS: `content_media` Table — Add Missing UPDATE and DELETE Policies

**Problem:** `supabase/migrations/20260328123000_content_media_rls.sql` only defines INSERT and SELECT policies. Users cannot delete their own media attachments, and a user with a crafted request could attempt to modify another user's media rows (UPDATE has no policy, which means it falls through to deny by default — but the gap creates confusion and future risk as policies evolve).

- [ ] **SEC-004 — Add DELETE and UPDATE policies to `content_media`**
  - Create a new migration:
    ```sql
    CREATE POLICY "Users can delete their own content media"
      ON content_media FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM generated_content
          WHERE id = content_id AND user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update their own content media"
      ON content_media FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM generated_content
          WHERE id = content_id AND user_id = auth.uid()
        )
      );
    ```
  - Add FK constraint: `ALTER TABLE content_media ADD CONSTRAINT content_media_content_id_fkey FOREIGN KEY (content_id) REFERENCES generated_content(id) ON DELETE CASCADE;` *(if not already present)*.
  - **DoD:** A user authenticated as User A cannot delete or update a `content_media` row whose `content_id` belongs to User B. Verify via Supabase Studio using two test accounts.

---

### 1.3 Encrypt Social API Credentials via Supabase Vault

**Problem:** `supabase/functions/publish-content/index.ts` reads `socialAccount.credentials` which is a plaintext JSONB blob in `social_accounts.credentials` (added in migration `20260308230406`). This column stores Facebook Page tokens, LinkedIn access tokens, and Twitter API key/secret pairs in cleartext. A DB breach exposes all connected social accounts.

- [ ] **SEC-005 — Enable `pgsodium` / Supabase Vault and create an encryption wrapper**
  - Enable Vault in the Supabase project dashboard (Extensions → `supabase_vault`).
  - Create a migration that adds a `credentials_encrypted` column and a Vault secret per row:
    ```sql
    ALTER TABLE public.social_accounts
      ADD COLUMN vault_secret_id UUID REFERENCES vault.secrets(id);
    ```
  - Write a migration helper function:
    ```sql
    CREATE OR REPLACE FUNCTION store_social_credentials(
      account_id UUID, creds JSONB
    ) RETURNS void AS $$
    DECLARE secret_id UUID;
    BEGIN
      INSERT INTO vault.secrets (secret, name)
        VALUES (creds::text, 'social_creds_' || account_id::text)
        ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret
        RETURNING id INTO secret_id;
      UPDATE social_accounts SET vault_secret_id = secret_id WHERE id = account_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```
  - Update `supabase/functions/publish-content/index.ts`: replace `socialAccount.credentials` reads with a Vault decryption call:
    ```typescript
    const { data: secret } = await supabase.rpc('vault.decrypted_secrets')
      .eq('id', socialAccount.vault_secret_id).single();
    const creds = JSON.parse(secret.decrypted_secret);
    ```
  - Update `src/pages/PublisherConnect.tsx` `handleConnect()`: instead of writing `credentials` directly, call the `store_social_credentials` DB function via `supabase.rpc()`.
  - Drop the plaintext `credentials` column after migration is confirmed working:
    ```sql
    ALTER TABLE public.social_accounts DROP COLUMN credentials;
    ```
  - **DoD:** Running `SELECT credentials FROM social_accounts;` returns no rows with this column (column dropped). Publish-content correctly decrypts credentials and posts to Facebook successfully. A DB dump does not contain plaintext API tokens.

---

### 1.4 Fix the Non-Functional Notification System

**Problem:** `supabase/functions/notify/index.ts` builds HTML email bodies and logs them to console, but never sends anything. It returns `{ success: true }` regardless. The Settings page toggles (`notifyHotLeads`, `notifyPublished`) are plain `useState` booleans with no DB persistence — they reset on every page load.

- [ ] **BUG-001 — Implement actual email sending in `notify/index.ts`**
  - The `RESEND_API_KEY` secret is already configured (used by `send-lead-email`). Use it here.
  - Replace the `console.log` + fake return in `notify/index.ts` with a Resend API call:
    ```typescript
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Mako <alerts@yourdomain.com>", to: [user.email], subject, html: htmlBody }),
    });
    if (!resendRes.ok) throw new Error("Resend failed: " + await resendRes.text());
    ```
  - **DoD:** Submitting a lead via the contact form that gets classified as "hot" results in an email delivered to the account owner's inbox within 60 seconds. Verify with a real email address in a test environment.

- [ ] **BUG-002 — Add `notification_preferences` column to `profiles` table**
  - Create a migration:
    ```sql
    ALTER TABLE public.profiles
      ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{"hot_leads": true, "content_published": true}'::jsonb;
    ```
  - Update `src/pages/SettingsPage.tsx`:
    - On mount, load preferences from `profiles.notification_preferences` using the existing `loadProfile()` call — include `notification_preferences` in the SELECT.
    - On toggle change, call `supabase.from("profiles").update({ notification_preferences: { hot_leads: ..., content_published: ... } }).eq("user_id", user.id)` immediately (debounced 500ms).
    - Remove the two `useState` booleans and derive state from the loaded profile object.
  - Update `supabase/functions/notify/index.ts`: before sending, load `profiles.notification_preferences` for the user and check if the relevant preference is `true`. Skip sending if disabled.
  - **DoD:** Toggle "Hot Lead Alerts" to OFF, reload the page — the toggle remains OFF. Submit a lead classified as hot — no email is received. Toggle back ON — hot lead email resumes.

---

### 1.5 Fix BrandBrain Save Race Condition

**Problem:** `src/pages/BrandBrain.tsx` `handleSave()` performs a SELECT to check for an existing row, then separately runs UPDATE or INSERT. Two simultaneous saves create duplicate `brand_brains` rows despite the `UNIQUE(user_id)` constraint — the second insert fails with a constraint error instead of gracefully updating.

- [ ] **BUG-003 — Replace SELECT + UPDATE/INSERT with `upsert` in `BrandBrain.tsx`**
  - In `handleSave()`, replace the entire try block with:
    ```typescript
    const { error } = await supabase
      .from("brand_brains")
      .upsert({ ...toDb(data), user_id: user.id }, { onConflict: "user_id" });
    if (error) throw error;
    ```
  - Remove the `existing` variable, the preliminary SELECT, and the if/else branching.
  - **DoD:** Open BrandBrain in two browser tabs simultaneously. Fill in the Company Name field in both and click Save in both within 1 second. Both saves succeed (no 409/500 error). Only one row exists in `brand_brains` for the user. The saved value is from whichever save completed last.

---

### 1.6 Sanitize AI-Generated HTML Against XSS

**Problem:** `src/pages/ContentEngine.tsx` (the `ContentClamp` component, line 591) and `src/pages/Scheduler.tsx` (line 448) render AI-generated content using `dangerouslySetInnerHTML` without sanitization. AI models can occasionally generate `<script>` tags or `onerror` attributes.

- [ ] **SEC-006 — Install DOMPurify and wrap all `dangerouslySetInnerHTML` calls**
  - Install: `npm install dompurify @types/dompurify`
  - Create `src/lib/sanitize.ts`:
    ```typescript
    import DOMPurify from "dompurify";
    export const sanitizeHtml = (html: string): string =>
      DOMPurify.sanitize(html, { ALLOWED_TAGS: ["b","i","em","strong","p","br","ul","ol","li","a"], ALLOWED_ATTR: ["href"] });
    ```
  - In `src/pages/ContentEngine.tsx` `ContentClamp` component: wrap the `html` prop: `dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}`.
  - In `src/pages/Scheduler.tsx` line 448: wrap the content: `dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}`.
  - In `src/pages/EditContent.tsx` (if it renders AI content via innerHTML): apply the same wrapper.
  - **DoD:** Insert a `generated_content` row manually via Supabase Studio with `content = '<script>alert(1)</script><b>Hello</b>'`. Load ContentEngine — the alert does NOT fire, `<b>Hello</b>` renders correctly.

---

### 1.7 Migrate Data Fetching to TanStack Query

**Problem:** Every page (`BrandBrain.tsx`, `ContentEngine.tsx`, `LeadAgent.tsx`, `Analytics.tsx`, `Scheduler.tsx`, `PublisherConnect.tsx`, `SettingsPage.tsx`) implements data fetching with raw `useState` + `useEffect` + direct `supabase.from()` calls. There is no request deduplication, no background refetch, no unified error/loading state, and no cache. `@tanstack/react-query` is installed but completely unused.

- [ ] **REFACTOR-001 — Create shared query key constants**
  - Create `src/lib/queryKeys.ts`:
    ```typescript
    export const queryKeys = {
      brandBrain: (userId: string) => ["brandBrain", userId],
      generatedContent: (userId: string) => ["generatedContent", userId],
      leads: (userId: string) => ["leads", userId],
      socialAccounts: (userId: string) => ["socialAccounts", userId],
      profile: (userId: string) => ["profile", userId],
    } as const;
    ```

- [ ] **REFACTOR-002 — Migrate `BrandBrain.tsx` to `useQuery` / `useMutation`**
  - Replace the `useEffect` + `supabase.from("brand_brains").select(...)` load with:
    ```typescript
    const { data: row, isLoading } = useQuery({
      queryKey: queryKeys.brandBrain(user!.id),
      queryFn: () => supabase.from("brand_brains").select("*").eq("user_id", user!.id).maybeSingle().then(r => r.data),
      enabled: !!user,
    });
    ```
  - Replace `handleSave` direct call with `useMutation` that calls `supabase.from("brand_brains").upsert(...)` and on success calls `queryClient.invalidateQueries({ queryKey: queryKeys.brandBrain(user!.id) })`.
  - Remove all `useState` for `data`, `saving`, and `loading` — derive from query/mutation state.
  - **DoD:** BrandBrain page loads without a `useEffect`. The network tab shows exactly one request to `brand_brains` on mount. Navigating away and back does not re-fetch (uses cache). Saving shows a loading state derived from `mutation.isPending`.

- [ ] **REFACTOR-003 — Migrate `ContentEngine.tsx` to `useQuery` / `useMutation`**
  - Replace `loadContent()` with a `useQuery` on `queryKeys.generatedContent(user.id)`.
  - Replace `deleteContent()` with a `useMutation` that on success removes the item from cache via `queryClient.setQueryData`.
  - Replace the `checkBrandBrain()` `useEffect` with a `useQuery` on `queryKeys.brandBrain(user.id)` (reuse the same key as BrandBrain page — it will be served from cache if already loaded).
  - **DoD:** ContentEngine does not define any `useEffect` for data fetching. Generating new content invalidates `queryKeys.generatedContent` and the list updates without a manual `loadContent()` call.

- [ ] **REFACTOR-004 — Migrate `LeadAgent.tsx`, `Scheduler.tsx`, `Analytics.tsx`, `PublisherConnect.tsx`, `SettingsPage.tsx`**
  - Apply the same pattern as REFACTOR-002/003 to each remaining page.
  - For `Analytics.tsx`: the three parallel loads (`loadContentStats`, `loadLeadStats`, `loadWeeklyTrend`) become three independent `useQuery` calls with `enabled: !!user`. Remove `loadAllData()` and `Promise.all` wrapper.
  - **DoD:** Zero `useEffect` hooks remain in these files that exist solely to fetch data. All loading states are derived from `isLoading` / `isFetching`. All mutations invalidate the correct query keys.

---

## Phase 2 — Architectural Scalability

> These changes unlock the ability to sell Mako to any customer, not just Tekrem.

---

### 2.1 Remove Hardcoded Tenant Logic and Implement Workspaces

**Problem:** Business-specific context for "Tekrem Innovations" and "Tekrem Innvation Solutions" is hardcoded in four files: `src/pages/ContentEngine.tsx` (lines 26-38), `supabase/functions/generate-content/index.ts` (lines 28-39), `supabase/functions/daily-content-workflow/index.ts` (lines 12-33), and `src/pages/ContactForm.tsx` (lines 12-39). Adding a new customer requires source code changes and redeployment.

- [ ] **ARCH-001 — Create the `workspaces` table**
  - Create migration `supabase/migrations/<timestamp>_add_workspaces.sql`:
    ```sql
    CREATE TABLE public.workspaces (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL,
      logo_url    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, slug)
    );
    ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users manage own workspaces"
      ON public.workspaces FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Migrate each existing brand_brain into a default workspace
    INSERT INTO public.workspaces (user_id, name, slug)
    SELECT user_id, COALESCE(company_name, 'My Brand'), 'default'
    FROM public.brand_brains;
    ```

- [ ] **ARCH-002 — Add `workspace_id` FK to downstream tables**
  - Create migration:
    ```sql
    ALTER TABLE public.brand_brains     ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    ALTER TABLE public.generated_content ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    ALTER TABLE public.leads             ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    ALTER TABLE public.social_accounts  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    ALTER TABLE public.lead_sources     ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);

    -- Backfill using the default workspace created in ARCH-001
    UPDATE public.brand_brains b
      SET workspace_id = w.id
      FROM public.workspaces w WHERE w.user_id = b.user_id AND w.slug = 'default';
    -- Repeat for other tables
    ```
  - Update all RLS policies on the above tables to add: `AND workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())` *(or keep user_id-based policies and rely on the workspace FK for logical scoping — choose one pattern and apply it consistently)*.

- [ ] **ARCH-003 — Build workspace context in the frontend**
  - Create `src/hooks/useWorkspace.tsx`:
    ```typescript
    // Stores the active workspace_id in localStorage.
    // Exposes: activeWorkspace, workspaces, setActiveWorkspace.
    ```
  - Add a workspace switcher dropdown to `src/components/AppSidebar.tsx` that lists all workspaces for the current user and sets the active one.
  - Pass `workspace_id` into all `supabase.from()` queries that target workspace-scoped tables.

- [ ] **ARCH-004 — Remove hardcoded `tekremSystems` from `ContentEngine.tsx`**
  - Delete lines 26-38 (the `tekremSystems` constant) and the "System / Product" `<Select>` block (lines 380-391).
  - The active workspace (from `useWorkspace`) already determines which Brand Brain is loaded. No separate system selector is needed.
  - **DoD:** The Content Engine page no longer renders a "System / Product" dropdown. Generating content uses the Brand Brain associated with the active workspace.

- [ ] **ARCH-005 — Remove hardcoded systems from `generate-content` Edge Function**
  - Delete lines 28-40 in `supabase/functions/generate-content/index.ts` (the `systemContextMap` and `systemContext` logic).
  - The function already loads the full Brand Brain from the DB — the Brand Brain's `description` and `services` fields provide the equivalent context dynamically.
  - Remove the `system` field from the function's accepted request body.
  - **DoD:** Calling `generate-content` without a `system` parameter generates on-brand content using only the Brand Brain. No reference to "Tekrem" or "Tekrem Innvation Solutions" appears in generated output for a new user's brand.

- [ ] **ARCH-006 — Remove hardcoded systems from `daily-content-workflow` Edge Function**
  - Delete the `systems` constant (lines 12-33) in `supabase/functions/daily-content-workflow/index.ts`.
  - Replace the inner `for (const system of systems)` loop with a loop over the user's `workspaces` — fetching the Brand Brain associated with each workspace.
  - **DoD:** Running the daily workflow for a user with 2 workspaces generates content for both workspaces using their respective Brand Brains, with no hardcoded company names in prompts.

- [ ] **ARCH-007 — Remove hardcoded branding from `ContactForm.tsx`**
  - Delete the `systemBranding` constant (lines 12-39) in `src/pages/ContactForm.tsx`.
  - Change the route from `/contact/:userId` to `/contact/:sourceId` (using the `lead_sources` table from SEC-003).
  - On mount, load the workspace name, logo, and description from the DB using the `source_id` to resolve the workspace. Render the form with dynamic branding.
  - Update `src/pages/SettingsPage.tsx` to generate contact form URLs using `source_id` instead of `user.id`.
  - **DoD:** A new user creates a workspace named "Bright Coffee Co." The embeddable contact form at their unique URL displays "Bright Coffee Co." branding with no mention of Tekrem or Tekrem Innvation Solutions. The existing Tekrem/Tekrem Innvation Solutions URLs continue to work if their workspace slugs are migrated correctly.

---

### 2.2 Implement Automated Scheduled Publishing with pg_cron

**Problem:** `src/pages/Scheduler.tsx` has a fully functional drag-and-drop calendar that assigns `scheduled_date` to posts. However, there is no background job that reads approved posts with a past `scheduled_date` and publishes them. Users must click Publish manually.

- [ ] **ARCH-008 — Add `scheduled_time` and `publish_failed_reason` columns**
  - Create migration:
    ```sql
    ALTER TABLE public.generated_content
      ADD COLUMN scheduled_time  TIMETZ,
      ADD COLUMN publish_failed_reason TEXT,
      ADD COLUMN published_at   TIMESTAMPTZ;
    ```

- [ ] **ARCH-009 — Create the `auto-publish` Edge Function**
  - Create `supabase/functions/auto-publish/index.ts`.
  - The function must:
    1. Validate a `CRON_SECRET` header to prevent unauthorized invocations: `if (req.headers.get("X-Cron-Secret") !== Deno.env.get("CRON_SECRET")) return 401`.
    2. Query `generated_content` for rows where `status = 'approved'` AND `scheduled_date IS NOT NULL` AND `(scheduled_date + COALESCE(scheduled_time, '09:00'::timetz)) <= now()`.
    3. For each row, invoke the publish logic from `publish-content/index.ts` — extract this logic into a shared helper (`supabase/functions/_shared/publishToplatform.ts`) imported by both functions.
    4. On success: `UPDATE generated_content SET status = 'published', published_at = now() WHERE id = ...`.
    5. On failure: `UPDATE generated_content SET publish_failed_reason = '...' WHERE id = ...` (do not change status to allow retry).
    6. Return `{ published: N, failed: M }`.
  - **DoD:** A post with `status = 'approved'`, `scheduled_date = yesterday`, and `scheduled_time = '09:00'` is automatically updated to `status = 'published'` within 15 minutes of the cron running.

- [ ] **ARCH-010 — Register the pg_cron job**
  - Create migration:
    ```sql
    SELECT cron.schedule(
      'auto-publish-scheduled-content',
      '*/15 * * * *',
      format(
        $$SELECT net.http_post(url := %L, headers := %L, body := %L)$$,
        current_setting('app.supabase_functions_url') || '/auto-publish',
        json_build_object('Content-Type','application/json','X-Cron-Secret', current_setting('app.cron_secret'))::text,
        '{}'
      )
    );
    ```
  - Store `CRON_SECRET` in Supabase project secrets (Dashboard → Edge Functions → Secrets).
  - **DoD:** `SELECT * FROM cron.job WHERE jobname = 'auto-publish-scheduled-content'` returns a row. The Edge Function logs show invocations every 15 minutes.

- [ ] **ARCH-011 — Show publish status in `Scheduler.tsx`**
  - Add a `publish_failed_reason` tooltip to failed posts in the calendar and list views.
  - Add a "Retry" button for posts where `publish_failed_reason IS NOT NULL`.
  - Show `published_at` timestamp instead of `created_at` for published posts.
  - **DoD:** A post that fails to publish (e.g., expired Facebook token) shows a red indicator with the failure reason. Clicking Retry re-attempts the publish call.

---

## Phase 3 — Core Feature Completion

---

### 3.1 Fix Real Publishing: Facebook, LinkedIn, WhatsApp, Instagram, Twitter

**Current state:** Only Facebook and LinkedIn have real API calls. Instagram, Twitter, and WhatsApp return success responses without actually publishing anything.

- [ ] **FEAT-001 — Fix Instagram Publishing (Media Container flow)**
  - In `supabase/functions/publish-content/index.ts`, replace the Instagram stub (lines 104-111) with the two-step Media API:
    1. POST to `https://graph.facebook.com/v18.0/{igAccountId}/media` with `{ image_url, caption, access_token }` to create a media container. Store the container `id`.
    2. POST to `https://graph.facebook.com/v18.0/{igAccountId}/media_publish` with `{ creation_id: containerId, access_token }`.
  - The `content.media_url` from `generated_content` (or the first `content_media` attachment) is used as `image_url`. If no media is attached, set `published = false` and `publishResult = "Instagram requires an image. Attach one before publishing."`.
  - **DoD:** A generated Instagram caption with an attached AI image, when Publish is clicked, creates a live post on the connected Instagram Business account. The post ID is stored in `publish_failed_reason` or a new `external_post_id` column.

- [ ] **FEAT-002 — Fix Twitter/X Publishing (OAuth 2.0 PKCE or App-only)**
  - Replace the Twitter stub (lines 113-121 in `publish-content/index.ts`) with Twitter API v2 Tweet endpoint.
  - Use OAuth 2.0 App-Only auth (Bearer token) for publishing on behalf of the connected account — this requires the user to provide their own Bearer token rather than API key + secret. Update `src/pages/PublisherConnect.tsx` Twitter fields to request `bearer_token` instead of `api_key` + `api_secret`.
  - POST to `https://api.twitter.com/2/tweets` with `{ text: content.slice(0, 280) }`.
  - **DoD:** A generated X/Twitter post, when Publish is clicked with a valid Bearer token configured, appears as a live tweet on the connected account within 30 seconds.

- [ ] **FEAT-003 — Implement WhatsApp Business Cloud API Publishing**
  - Replace the WhatsApp stub (lines 122-130 in `publish-content/index.ts`) with Meta Cloud API calls.
  - Create `supabase/migrations/<timestamp>_add_whatsapp_contacts.sql`:
    ```sql
    CREATE TABLE public.whatsapp_contacts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      workspace_id UUID REFERENCES public.workspaces(id),
      phone       TEXT NOT NULL,
      name        TEXT,
      opted_in    BOOLEAN NOT NULL DEFAULT false,
      opted_in_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, phone)
    );
    ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users manage own WA contacts"
      ON public.whatsapp_contacts FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    ```
  - In `publish-content`, for `platform === 'whatsapp'`: query `whatsapp_contacts` where `user_id = user.id AND opted_in = true`. For each contact, POST to `https://graph.facebook.com/v18.0/{phoneNumberId}/messages` with a text message body.
  - Add a WhatsApp Contacts tab in `src/pages/LeadAgent.tsx` to import contacts (CSV upload or manual entry) and show opt-in status.
  - **DoD:** A user with 3 opted-in WhatsApp contacts and a connected WhatsApp Business number clicks Publish on a WhatsApp post — all 3 contacts receive the message. The UI shows "Sent to 3 contacts."

---

### 3.2 Resolve the Media Schema Split

**Problem:** `generated_content` has both `media_url`/`media_type` columns (single media) AND a `content_media` table (multiple attachments). `ContentEngine.tsx` `loadContent()` joins both and the display code handles both paths. This causes inconsistency and will cause data loss bugs.

- [ ] **FEAT-004 — Migrate all single media to `content_media`, drop legacy columns**
  - Create migration:
    ```sql
    -- Migrate existing media_url rows into content_media
    INSERT INTO content_media (content_id, media_url, media_type)
    SELECT id, media_url, COALESCE(media_type, 'image')
    FROM generated_content
    WHERE media_url IS NOT NULL AND media_url NOT LIKE '[%'; -- exclude slideshow JSON

    -- Handle slideshow JSON: expand array into individual rows
    INSERT INTO content_media (content_id, media_url, media_type)
    SELECT id, jsonb_array_elements_text(media_url::jsonb), 'image'
    FROM generated_content
    WHERE media_url LIKE '[%';

    -- Drop legacy columns
    ALTER TABLE generated_content DROP COLUMN media_url;
    ALTER TABLE generated_content DROP COLUMN media_type;
    ```
  - Update `src/pages/ContentEngine.tsx`: remove all references to `item.media_url`, `item.media_type`, and the slideshow JSON parse logic in the Scheduler. All media is now read exclusively from `item.attachments` (the `content_media` join).
  - Update `supabase/functions/generate-content/index.ts` and `daily-content-workflow/index.ts`: after inserting into `generated_content`, insert media into `content_media` instead of writing `media_url`.
  - **DoD:** No references to `media_url` or `media_type` remain in any Edge Function or React component. All existing content with images still displays correctly. New content generated shows images via the `content_media` join.

---

### 3.3 UTM Tracking and Lead-to-Revenue Conversion

- [ ] **FEAT-005 — Create `campaigns` table and UTM link generation**
  - Create migration:
    ```sql
    CREATE TABLE public.campaigns (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      workspace_id UUID REFERENCES public.workspaces(id),
      name         TEXT NOT NULL,
      utm_source   TEXT,
      utm_medium   TEXT NOT NULL DEFAULT 'brandpilot',
      utm_campaign TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users manage own campaigns"
      ON public.campaigns FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    ALTER TABLE public.leads
      ADD COLUMN campaign_id      UUID REFERENCES public.campaigns(id),
      ADD COLUMN utm_source       TEXT,
      ADD COLUMN utm_medium       TEXT,
      ADD COLUMN utm_campaign     TEXT,
      ADD COLUMN deal_value       DECIMAL(10,2),
      ADD COLUMN converted_at     TIMESTAMPTZ;
    ```
  - Update `supabase/functions/lead-webhook/index.ts`: extract `utm_source`, `utm_medium`, `utm_campaign` from the request body and store them on the `leads` row. Look up `campaigns` by `utm_campaign` value to set `campaign_id`.
  - Update `src/pages/SettingsPage.tsx` embed code generator: append `?utm_source={platform}&utm_medium=brandpilot&utm_campaign={campaign_slug}` to contact form URLs.

- [ ] **FEAT-006 — Add "Mark as Converted" to Lead Agent**
  - In `src/pages/LeadAgent.tsx`, add a "Converted 💰" button per lead (shown when `status !== 'meeting_booked'` is false, i.e., post-meeting).
  - Clicking opens a small dialog: `Deal Value (optional)` input + confirm button.
  - On confirm: `supabase.from("leads").update({ converted_at: new Date().toISOString(), deal_value: amount }).eq("id", lead.id)`.
  - **DoD:** Marking a lead as converted sets `converted_at` and `deal_value`. The Analytics page shows total converted leads and sum of `deal_value` for the current month.

- [ ] **FEAT-007 — Add campaign performance to `Analytics.tsx`**
  - Add a new chart card: "Leads by Campaign" — bar chart showing lead count and conversion count per `utm_campaign`.
  - Add a "Pipeline Value" stat card: `SUM(deal_value)` where `converted_at IS NOT NULL` for the current month.
  - Add a "Conversion Rate" stat: `COUNT(converted_at) / COUNT(*) * 100` across all leads.
  - **DoD:** Analytics page shows pipeline value and conversion rate. These stats update within 30 seconds of marking a lead as converted (via TanStack Query cache invalidation).

---

## Phase 4 — Monetization & Infrastructure

---

### 4.1 Subscription Schema and Plan Definitions

- [ ] **MON-001 — Create `subscriptions` and `ai_usage` tables**
  - Create migration:
    ```sql
    CREATE TABLE public.subscriptions (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      plan                  TEXT NOT NULL DEFAULT 'free'
                              CHECK (plan IN ('free', 'starter', 'pro')),
      status                TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
      billing_period_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
      billing_period_end    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
      paystack_customer_id  TEXT,
      paystack_sub_code     TEXT,
      stripe_customer_id    TEXT,
      stripe_sub_id         TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users view own subscription"
      ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

    CREATE TABLE public.ai_usage (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      workspace_id UUID REFERENCES public.workspaces(id),
      function_name TEXT NOT NULL,
      tokens_used  INT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users view own usage"
      ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

    -- Auto-create a free subscription on signup
    CREATE OR REPLACE FUNCTION public.handle_new_subscription()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.subscriptions (user_id) VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    CREATE TRIGGER on_user_created_subscription
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();
    ```

  - **Plan limits** (enforce in Edge Functions):
    | Plan | AI Generations/Month | Workspaces | WhatsApp Contacts | Channels |
    |---|---|---|---|---|
    | free | 10 | 1 | 0 | 0 (generate only) |
    | starter ($15/mo) | 100 | 3 | 100 | Facebook + LinkedIn |
    | pro ($35/mo) | unlimited | unlimited | 1,000 | All |

---

### 4.2 AI Usage Gating in Edge Functions

- [ ] **MON-002 — Create shared `checkAndIncrementUsage` helper**
  - Create `supabase/functions/_shared/usageGate.ts`:
    ```typescript
    export async function checkAndIncrementUsage(
      supabase: SupabaseClient,
      userId: string,
      functionName: string
    ): Promise<{ allowed: boolean; reason?: string }> {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, billing_period_start, billing_period_end, status")
        .eq("user_id", userId)
        .single();

      if (!sub || sub.status !== "active") return { allowed: false, reason: "No active subscription." };

      const limits: Record<string, number> = { free: 10, starter: 100, pro: Infinity };
      const limit = limits[sub.plan] ?? 10;

      if (limit !== Infinity) {
        const { count } = await supabase
          .from("ai_usage")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", sub.billing_period_start)
          .lte("created_at", sub.billing_period_end);

        if ((count ?? 0) >= limit) {
          return { allowed: false, reason: `Plan limit of ${limit} AI generations/month reached. Upgrade to continue.` };
        }
      }

      await supabase.from("ai_usage").insert({ user_id: userId, function_name: functionName });
      return { allowed: true };
    }
    ```
  - Import and call `checkAndIncrementUsage` at the top of the try block in:
    - `supabase/functions/generate-content/index.ts`
    - `supabase/functions/generate-image/index.ts`
    - `supabase/functions/generate-slideshow/index.ts`
    - `supabase/functions/repurpose-content/index.ts`
  - Return HTTP 402 with `{ error: reason, upgrade: true }` if `allowed === false`.
  - **DoD:** Create a free account. Make 10 successful content generation calls. The 11th call returns HTTP 402 with `"Plan limit of 10 AI generations/month reached."`. The UI in `ContentEngine.tsx` detects the `upgrade: true` flag and shows an upgrade prompt modal instead of a generic error toast.

---

### 4.3 Paystack Integration

- [ ] **MON-003 — Create Paystack checkout Edge Function**
  - Create `supabase/functions/create-checkout/index.ts`:
    - Accept `{ plan: "starter" | "pro" }` in the request body.
    - Call Paystack Initialize Transaction API (`https://api.paystack.co/transaction/initialize`) with the user's email, the plan's amount in Kobo/Pesewas, `metadata: { user_id, plan }`, and a `callback_url` pointing to the app's `/billing/success` route.
    - Return `{ authorization_url }` to the client.
  - Add `PAYSTACK_SECRET_KEY` to Supabase project secrets.
  - In the frontend, add a "Upgrade" button in the dashboard header (visible when `subscription.plan === 'free'` and `ai_usage_count > 7`). On click, call `create-checkout` and redirect to the returned `authorization_url`.
  - **DoD:** Clicking Upgrade on a free account opens the Paystack checkout page. Completing a test payment redirects back to `/billing/success`.

- [ ] **MON-004 — Create Paystack webhook handler Edge Function**
  - Create `supabase/functions/paystack-webhook/index.ts`:
    - Verify the `X-Paystack-Signature` header using HMAC-SHA512 of the raw body with `PAYSTACK_SECRET_KEY`. Reject if invalid.
    - Handle event `charge.success`: extract `metadata.user_id` and `metadata.plan` from the payload. Update `subscriptions` table: set `plan`, reset `billing_period_start = now()`, `billing_period_end = now() + interval '1 month'`, `status = 'active'`, store `paystack_customer_id`.
    - Handle event `subscription.disable`: set `subscriptions.status = 'cancelled'`, `plan = 'free'`.
    - **DoD:** Triggering a simulated `charge.success` event from the Paystack dashboard updates the user's `subscriptions.plan` from `'free'` to `'starter'` within 5 seconds. The usage limit for subsequent AI calls reflects the new plan limit of 100.

- [ ] **MON-005 — Build Billing page in the frontend**
  - Create `src/pages/BillingPage.tsx` and add route `/billing` to `src/App.tsx`.
  - Display: current plan name, billing period dates, AI usage meter (`COUNT(ai_usage) / plan_limit * 100%`), and an Upgrade/Manage button.
  - Usage meter shows a warning color at ≥ 80% consumption.
  - Add the Billing link to `src/components/AppSidebar.tsx`.
  - **DoD:** A free user visiting `/billing` sees "Free Plan — 7 of 10 AI generations used this month" with a progress bar at 70%. The "Upgrade to Starter" button initiates the Paystack checkout flow.

---

### 4.4 Unify the AI Provider

**Problem:** `generate-content` uses `api.mistral.ai` directly. `lead-webhook`, `repurpose-content`, `daily-content-workflow` use `ai.gateway.lovable.dev`. Two AI vendors, two API keys, two billing accounts, two sets of error handling.

- [ ] **MON-006 — Standardize all AI calls through a single shared wrapper**
  - Create `supabase/functions/_shared/aiClient.ts`:
    ```typescript
    export async function callAI(messages: Message[], opts?: { model?: string }): Promise<string> {
      const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${MISTRAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: opts?.model ?? "mistral-large-latest", messages }),
      });
      if (!res.ok) {
        if (res.status === 429) throw new Error("RATE_LIMIT");
        if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
        throw new Error("AI_ERROR: " + res.status);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    ```
  - Replace all `fetch("https://ai.gateway.lovable.dev/...")` calls in `repurpose-content`, `lead-webhook`, and `daily-content-workflow` with `callAI(messages)`.
  - Remove `LOVABLE_API_KEY` from all Edge Functions and from Supabase secrets.
  - **DoD:** No Edge Function references `lovable.dev` or `LOVABLE_API_KEY`. All AI calls go through Mistral. One API key, one billing account, one error handling path.

---

### 4.5 Fix the `notify` Function — Restrict Access

- [ ] **SEC-007 — Restrict `notify` to internal calls only**
  - In `supabase/functions/notify/index.ts`, add a secret check:
    ```typescript
    const callerSecret = req.headers.get("X-Internal-Secret");
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (callerSecret !== internalSecret) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    ```
  - Store `INTERNAL_FUNCTION_SECRET` in Supabase secrets.
  - Update all callers (`lead-webhook/index.ts` line 101, `publish-content/index.ts` line 143) to include this header in their internal fetch calls.
  - **DoD:** A `curl` POST to the `notify` endpoint without the `X-Internal-Secret` header returns `403 Forbidden`. The hot lead notification flow (lead submitted → lead-webhook calls notify → email sent) continues to work end-to-end.

---

---

## Phase 5 — Full RBAC, Multi-Tenancy, Templates, Media Library, Replies

> Implemented in session 2. All items below map to delivered files.

### 5.1 Database Migrations Delivered

| File | Covers |
|---|---|
| `20260410000001_tenants_and_rbac.sql` | `tenants`, `roles`, `permissions`, `role_permissions`, `tenant_members`, `user_permissions`, auto-create trigger |
| `20260410000002_rbac_functions_and_seed.sql` | `user_has_permission()`, `current_user_has_permission()`, `get_member_role()`, all permission keys seeded, system roles + their permissions seeded |
| `20260410000003_add_tenant_id_to_tables.sql` | `tenant_id` added to `brand_brains`, `generated_content`, `leads`, `social_accounts`, `content_media`; old RLS dropped; new tenant-scoped RLS applied; DB trigger enforcing Creator cannot set `approved`/`published` status |
| `20260410000004_maker_checker.sql` | `maker_checker_config` (9 seeded actions), `maker_checker_requests`, `submit_for_approval()` helper |
| `20260410000005_content_templates.sql` | `content_templates` table, 7 system-seeded templates with full platform rules for Facebook, LinkedIn, Instagram, Twitter/X, WhatsApp, Email, Ad Copy |
| `20260410000006_media_library_and_replies.sql` | `content_media` enhanced (name, tags, file_size, dimensions, alt_text), `reply_rules`, `post_replies`, `audit_logs`, `log_audit_event()`, auto-audit trigger on content status changes |

### 5.2 Shared Libraries

| File | Purpose |
|---|---|
| `src/lib/permissions.ts` | Canonical `P.*` permission key constants, `MC.*` maker-checker keys, system role name constants |
| `src/lib/audit.ts` | `logAudit()` client helper, `submitForApproval()` wrapper |

### 5.3 React Hooks

| File | Purpose |
|---|---|
| `src/hooks/useTenant.tsx` | `TenantProvider` context, `useTenant()` hook, tenant switcher with localStorage persistence |
| `src/hooks/usePermissions.tsx` | `usePermissions()` — `can()`, `canAll()`, `canAny()`, module-level cache, `invalidate()` |

### 5.4 New Components

| File | Purpose |
|---|---|
| `src/components/PermissionGate.tsx` | Declarative `<PermissionGate require="...">` wrapper; `useGate()` imperative guard |
| `src/components/ErrorBoundary.tsx` | Class-based boundary; detects AI errors, rate limits, credit exhaustion; shows contextual recovery UI |
| `src/components/MediaPicker.tsx` | Reusable 3-tab picker (Library / Upload / URL) with tenant-scoped asset grid |

### 5.5 New Pages

| Route | File | Permission Required |
|---|---|---|
| `/admin/roles` | `src/pages/admin/RolesPage.tsx` | `admin.roles` or `team.assign_roles` |
| `/admin/maker-checker` | `src/pages/admin/MakerCheckerConfigPage.tsx` | `admin.maker_checker` (system admin only) |
| `/team` | `src/pages/team/TeamPage.tsx` | `team.view` |
| `/team/:userId/permissions` | `src/pages/team/UserPermissionsPage.tsx` | `team.assign_permissions` |
| `/approvals` | `src/pages/ApprovalsPage.tsx` | `approvals.view` |
| `/media` | `src/pages/MediaLibraryPage.tsx` | `media.view` |
| `/templates` | `src/pages/TemplatesPage.tsx` | `templates.view` |
| `/templates/:id` | `src/pages/TemplateEditPage.tsx` | `templates.create` / `templates.edit` |
| `/replies` | `src/pages/RepliesPage.tsx` | `replies.view` |
| `/audit` | `src/pages/AuditLogsPage.tsx` | `audit.view` |

### 5.6 Updated Files

| File | Change |
|---|---|
| `src/App.tsx` | Added `TenantProvider`, `ErrorBoundary`, 11 new routes |
| `src/components/AppSidebar.tsx` | Role-gated navigation groups (Core, Engagement, Assets, Governance, System Admin), tenant switcher dropdown |
| `supabase/functions/generate-content/index.ts` | Removed hardcoded Tekrem/Tekrem Innvation Solutions system map; loads active tenant template by platform; falls back to system-seeded template; uses `tenant_id` for brand brain lookup |

### 5.7 RBAC Enforcement Points

- **Database level:** `user_has_permission()` called in every RLS policy on scoped tables
- **DB trigger:** `enforce_content_status_transition()` — Creator/Viewer roles cannot set `approved`/`published` at the DB layer (not just UI)
- **Audit trigger:** `audit_content_status_change()` — every status change writes to `audit_logs` automatically
- **Client level:** `<PermissionGate>` hides UI elements; `useGate()` guards event handlers
- **Sidebar:** Navigation items rendered conditionally based on `can(P.*)` — no ghost links

### 5.8 Remaining Work (Next Sprint)

- [x] **NEXT-001** — Billing page + Paystack Edge Functions (`create-checkout`, `paystack-webhook`) + `subscriptions` + `ai_usage` tables
- [x] **NEXT-002** — PWA: `vite-plugin-pwa` configured, service worker generated, manifest with offline cache strategies and install shortcuts
- [x] **NEXT-003** — `ResetPassword.tsx` now handles both legacy hash flow (`#type=recovery`) and PKCE code flow (`?code=`)
- [x] **NEXT-004** — `/export` data export page with CSV download for leads, content, media, and audit logs
- [x] **NEXT-005** — Seat limit enforced via `enforce_seat_limit()` DB trigger on `tenant_members`; UI warning on Billing page
- [x] **NEXT-006** — WhatsApp contacts tab in Lead Agent: add manually, import CSV, toggle opt-in/opt-out, delete
- [x] **NEXT-007** — `fetch-comments` Edge Function: polls Facebook Graph API + LinkedIn Shares API for comments on published posts → upserts into `post_replies`
- [ ] **NEXT-008** — Supabase types regeneration: run `supabase gen types typescript --local > src/integrations/supabase/types.ts` after applying all migrations *(manual step — requires local Supabase running)*
- [x] **NEXT-009** — `daily-content-workflow` and `repurpose-content` fully rewritten: removed Lovable gateway + hardcoded Tekrem/Tekrem Innvation Solutions systems; now use `_shared/mistral.ts`, tenant-scoped brand brain + template lookup, usage gate
- [x] **NEXT-010** — Onboarding wizard (`OnboardingWizard.tsx`): detects brand brain absence, 3-step wizard (Welcome → Brand Brain → Done), integrated in `DashboardLayout`

### Phase 6 Additional Details

#### Shared Edge Function Infrastructure (`supabase/functions/_shared/`)
| File | Purpose |
|---|---|
| `mistral.ts` | `callAI()` + `complete()` — single Mistral client used by all functions |
| `usageGate.ts` | `checkAndIncrementUsage()` — reads subscription, counts `ai_usage` rows, blocks if limit exceeded, records usage |

#### Code-Splitting (future)
The bundle is 1.6 MB minified. Next steps:
```ts
// vite.config.ts — add to build.rollupOptions:
manualChunks: {
  vendor:   ['react','react-dom','react-router-dom'],
  ui:       ['@radix-ui/react-dialog','@radix-ui/react-tabs'],
  charts:   ['recharts'],
  supabase: ['@supabase/supabase-js'],
}
```

#### Remaining Items
- [ ] **PHASE7-001** — Run `supabase gen types typescript` and commit updated `types.ts`
- [ ] **PHASE7-002** — Code-split with `manualChunks` (target < 400 kB per chunk)
- [ ] **PHASE7-003** — E2E tests with Playwright (auth flow, content generation, billing checkout mock)
- [ ] **PHASE7-004** — i18n setup (react-i18next) — English + Nyanja initial locales
- [ ] **PHASE7-005** — Dark/light mode toggle in header (currently respects OS preference only)
- [ ] **PHASE7-006** — Push notifications via Web Push API (new content approved, approval queue alert)
- [ ] **PHASE7-007** — WhatsApp message sending integration (Vonage / Twilio Business) for opted-in contacts
- [ ] **PHASE7-008** — AI image generation Edge Function (`generate-image`) — uses Stable Diffusion or DALL-E, gated by plan, stores in Media Library
- [ ] **PHASE7-009** — Analytics page — real data from `generated_content` status counts, AI usage over time, lead conversion funnel (currently shows placeholder charts)
- [ ] **PHASE7-010** — Staging environment deployment to Vercel/Netlify with environment variable checklist

---

## Definition of Done — Global Standards

All tasks in this roadmap are considered complete only when:

1. **Code change** — The described change is implemented in the specified file(s).
2. **Migration applied** — Any SQL migration file is present in `supabase/migrations/` with a timestamp prefix and has been applied to the local and staging Supabase project.
3. **Tested** — The specific verification step in the task's DoD has been manually executed and passed in a staging environment with real data.
4. **No regressions** — `npm run test` passes. Existing functionality described in the audit as "actually working" continues to work.
5. **Types updated** — If a table schema changes, `src/integrations/supabase/types.ts` is regenerated via `supabase gen types typescript --local > src/integrations/supabase/types.ts`.
