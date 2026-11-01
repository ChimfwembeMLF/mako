# API Contract: Trinolux SMS Integration

## User Story 1

### `POST /api/v1/backoffice/sms/test`

Platform admins only (`JwtAuthGuard`, `SuperAdminGuard`).

Request:

```json
{ "to": "0971234567", "message": "Mako test message" }
```

`202 Accepted`:

```json
{ "accepted": true, "status": "Queued", "messageIds": [1842] }
```

`status` confirms acceptance, not delivery.

| Status | Meaning |
|---|---|
| 400 | Invalid number or message, or Trinolux rejected the request |
| 401 | Not logged in |
| 403 | Not a platform admin |
| 503 | SMS isn't configured, or Trinolux is unavailable after retries |

The Trinolux key is never returned.

## Provider error mapping

| Trinolux | Mako | Retry |
|---|---|---|
| 201, 202 with `success: true` | Accepted | No |
| 429 | Wait `retry_after_seconds` | Same key |
| 500-503, timeout | Backoff | Same key |
| 400, 402, 422 | 400 with provider message | No |
| 401, 403 | 503, "check the SMS key"; details logged for admins | No |
