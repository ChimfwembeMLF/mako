# Quickstart: System Admin Keys

## Validation Scenario 1: Fallback to `.env`

1. Start the application locally.
2. Ensure there is no `platform_integrations` record in the `system_settings` table.
3. Verify that features relying on `.env` (like AI classification or Google Auth) still function normally.

## Validation Scenario 2: Database Override

1. Log in to the application as a Super Admin.
2. Navigate to **System Settings**.
3. Under the **Platform Integrations** tab, enter a valid API key for Mistral (or another provider) that differs from the one in `.env` (or remove the one in `.env`).
4. Save the configuration.
5. Trigger an action that uses that integration (e.g., Lead Classification).
6. Verify the action succeeds using the key from the database.
7. Inspect the database directly to ensure the saved key is encrypted (not plain text).
