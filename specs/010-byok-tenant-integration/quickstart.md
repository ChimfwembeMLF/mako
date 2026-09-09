# Quickstart & Validation Guide

This guide describes how to validate the BYOK (Bring Your Own Key) Tenant Integration feature end-to-end.

## Prerequisites
- Rust API running (`cd api-rust && cargo run`)
- Access to the frontend (e.g. `http://localhost:5173`)
- A valid test OpenAI key: `sk-test-openai-key...`
- Postman or cURL if testing the API directly.
- The `ENCRYPTION_KEY` environment variable must be set in the `.env` file (e.g. `ENCRYPTION_KEY="your-32-byte-hex-string"`).

## Setup Commands

Run database migrations to create the `tenant_integration_configs` table:
```bash
# From the repo root
cd api && yarn migrations:run
```

## Validation Scenarios

### Scenario 1: Tenant configuring an API key
1. Navigate to the Tenant Settings view in the application.
2. In the "Integrations" section, locate the OpenAI card.
3. Enter your test OpenAI key into the input field and save.
4. Verify via DB query that the key is stored as ciphertext in `encrypted_api_key`. **Do not see plain text.**
   ```sql
   SELECT encrypted_api_key FROM tenant_integration_configs WHERE provider = 'openai';
   ```

### Scenario 2: Usage of the configured API key
1. Trigger an action in the app that consumes OpenAI on behalf of the tenant (e.g. "Generate post content").
2. Ensure the action succeeds.
3. Check your OpenAI platform dashboard. The usage should be attributed to the test key you provided.

### Scenario 3: Usage fallback
1. Go back to the Tenant Settings and delete your test key or enter an invalid key (`sk-invalid...`).
2. Trigger the OpenAI action again.
3. The action should still succeed, but this time it will use the platform's default `OPENAI_API_KEY`.
4. (Optional) Inspect the Rust API logs to verify the warning about falling back to the platform key.
