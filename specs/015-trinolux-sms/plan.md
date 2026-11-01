# Implementation Plan: Trinolux SMS Integration

**Branch**: `015-trinolux-sms` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

## Summary

Add a server-side Trinolux client and an admin-only test send first. Customer-facing SMS follows once the open questions on use cases and cost are answered.

## Technical Context

**Stack**: NestJS API, React website, Expo mobile

**Storage**: Encrypted platform integrations for User Story 1; new `sms_messages` table for User Story 2

**Testing**: Jest with a mocked provider, Vitest for admin UI

**Constraints**: 160 characters, Zambia only, production uses migrations rather than synchronize

## Constitution Check

| Principle | Status |
|---|---|
| I. Tenant & Workspace Isolation | Pass: User Story 1 has no tenant data; later stories use `TenantScopeInterceptor` and `tenant_id` |
| II. Secrets & External Integrations Safety | Pass: encrypted key, header auth, nothing sent to clients |
| III. Testable Contracts | Pass: provider behaviour tested against the documented responses |
| IV. Simplicity & Safe Background Work | Pass: no queue, SMPP or abstraction layer until a use case needs one |

## Project Structure

```text
api/src/modules/sms/
├── sms.module.ts
├── sms.service.ts              # send, retries, idempotency, error mapping
├── sms.service.spec.ts
├── sms-number.util.ts          # normalise and validate Zambian numbers
└── sms-number.util.spec.ts
api/src/modules/backoffice/     # test endpoint
client/src/components/admin/    # SmsSettings and SmsTestForm, shown in Platform Backoffice
```

## Complexity Tracking

None. A provider interface was left out on purpose, since Trinolux is the only provider.
