# Research: Trinolux SMS Integration

Source: Trinolux API documentation supplied on 2026-11-01. No call has been made to the live API.

| Topic | Finding | Decision |
|---|---|---|
| Base URL | `https://sms-api.trinolux.com/v1` | Hold it as a constant, overridable by `TRINOLUX_API_URL` |
| Auth | `X-API-KEY` with the SendSMS scope; a query parameter is also accepted | Use the header only, so keys stay out of URLs and logs |
| Send | `POST /sms/send` with `sender_id`, `to[]`, `message`, optional `message_type` (`SMS` or `OTP`) | Used by User Story 1 |
| Bulk and schedule | `POST /sms/bulk`, `POST /sms/schedule` with `schedule_at` | Deferred until a use case needs them |
| Status | `GET /sms`, `/sms/:id` and `/sms/:id/timeline` need a Bearer token | Blocks User Story 3 (Q3) |
| Limit | 160 characters per request | Validate before sending (Q4) |
| Acceptance | 202 for accepted or partial, 201 for scheduled | Check the HTTP status and `success`, never the message text |
| Partial | `status: "Partial"` with `sent` and `failed`, but `message_ids` doesn't say which recipient failed | Send one recipient per request for customer sends, so each result is unambiguous |
| Retries | Same key for 429 and 5xx; new key only for rejected recipients | Follow as documented |
| Billing errors | Documented under both 400 and 402/422 | Never retry; show the provider's message to admins |

## Alternatives considered

- **SMPP**: rejected. It needs a long-lived connection, and REST covers every planned use.
- **Tenant-owned keys now**: deferred to Q2. The existing `TenantIntegrationConfig` could store a key, but a Sender ID would need adding.
- **`/sms/send` with many recipients for campaigns**: rejected for later bulk work, which should use `/sms/bulk`.
