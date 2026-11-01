# Data Model: Trinolux SMS Integration

## User Story 1

No database change. Settings use the existing encrypted `platform_integrations` record:

| Key | Required | Purpose |
|---|---|---|
| `TRINOLUX_API_KEY` | Yes | Server-side API key with the SendSMS scope |
| `TRINOLUX_SENDER_ID` | Yes | Exact, case-sensitive approved Sender ID |
| `TRINOLUX_API_URL` | No | Overrides the default base URL |

## User Story 2 (proposed, pending Q1 and Q2)

Production runs with `DB_SYNCHRONIZE=false`, so this table needs a migration.

`sms_messages`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | Required; scopes every query |
| `workspace_id` | uuid | Optional |
| `user_id` | uuid | Who sent it |
| `lead_id` | uuid | Optional |
| `recipient` | text | Normalised number |
| `body` | text | Message text, deleted with tenant data |
| `status` | text | `Queued`, `Sent`, `Delivered`, `Failed`, `Cancelled`, `DeliveryUnknown`, `Rejected` |
| `provider_message_id` | bigint | From `message_ids` |
| `idempotency_key` | uuid | Unique |
| `error` | text | Provider's reason when rejected |
| `created_at`, `updated_at` | timestamptz | |

Adding SMS content means updating the privacy policy and data deletion handling.
