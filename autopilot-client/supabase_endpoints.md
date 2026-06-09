# Supabase Edge Function Endpoints

| Endpoint (Folder) | HTTP Method | Description |
|-------------------|-------------|-------------|
| `create-checkout` | POST | Initiates a Paystack checkout for a subscription plan. |
| `generate-content` | POST | Generates marketing content using AI (Mistral) with brand context and usage gating. |
| `lead-webhook` | POST | Receives lead form submissions, classifies via AI, stores lead, and triggers notifications for hot leads. |
| `paystack-webhook` | POST | Deprecated endpoint that returns 410 (gone). |
| `pawapay-webhook` | POST | Handles Pawapay webhook events (payment status updates). |
| `notify` | POST | Sends generic notifications (e.g., Slack, email) based on type payload. |
| `invite-user` | POST | Sends an invite email to a new user and creates an invitation record. |
| `unsubscribe` | POST | Processes unsubscribe requests for email communications. |
| `exchange-fb-token` | POST | Exchanges a Facebook short‑lived token for a long‑lived token. |
| `exchange-ig-token` | POST | Exchanges an Instagram short‑lived token for a long‑lived token. |
| `fetch-comments` | POST | Retrieves comments from social platforms (e.g., Facebook, Instagram) for a given post. |
| `generate-image` | POST | Calls an AI image generation service to create marketing images. |
| `generate-slideshow` | POST | Generates a slideshow (set of images) using AI based on provided prompts. |
| `daily-content-workflow` | POST | Orchestrates daily content generation and publishing workflow. |
| `auto-publish` | POST | Automatically publishes scheduled content items. |
| `scrape-brand` | POST | Scrapes brand information from a provided URL for onboarding. |
| `parse-brand-document` | POST | Parses uploaded brand documents (PDF, DOCX) to extract structured brand data. |
| `send-lead-email` | POST | Sends a formatted lead email to the sales team. |
| `check-pawapay-deposits` | POST | Checks the status of pending Pawapay deposits and updates DB. |
| `initiate-pawapay-deposit` | POST | Initiates a Pawapay deposit request for a tenant. |

> **Note**: All functions are Deno Edge Functions using `serve` from the standard library and are invoked via the Supabase Edge Functions API (`/functions/v1/<folder>`). The HTTP method is typically POST, except for the deprecated `paystack-webhook` which only returns a static response.

*The full source code for each function resides in `supabase/functions/<folder>/index.ts`.*
