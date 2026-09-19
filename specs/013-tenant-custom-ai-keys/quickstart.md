# Quickstart & Validation Guide

## Prerequisites
- A local instance of Mako running (`npm run dev:api` and `npm run dev:client`).
- A test tenant account with administrative access.
- A valid custom API key for Mistral or OpenAI (for testing BYOK flow).

## Validation Scenarios

### Scenario 1: Configure Custom Keys & Preferred Provider
1. Log into the test tenant account.
2. Navigate to Settings > Integrations.
3. Add a valid Mistral API key and set "Mistral" as the preferred provider.
4. Verify the settings save successfully and persist after a page refresh.

### Scenario 2: Generate Content with Custom Key
1. Navigate to the Content Engine.
2. Attempt to generate an AI draft using the "Generate AI copy" feature.
3. Check the backend server logs (`api/`) to verify that `AiProviderRouter` intercepted the request and routed it using the custom Mistral key.
4. Verify the content is successfully returned to the frontend.

### Scenario 3: Usage Limit Bypass
1. In the database, manually reduce the test tenant's AI usage limit to 0 (or a value lower than the next request's consumption).
2. Attempt to generate AI content again while the custom key is configured.
3. **Expected Outcome**: The request succeeds, bypassing the `assertWithinLimit` check.
4. Remove the custom key from the Integration Settings.
5. Attempt to generate AI content again.
6. **Expected Outcome**: The request fails with a "quota exceeded" or "upgrade plan" error, falling back to the default limit enforcement.
