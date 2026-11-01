# Tasks: Trinolux SMS Integration

**Input**: Design documents from `/specs/015-trinolux-sms/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story the task belongs to

## Phase 1: Foundation (User Story 1)

- [x] T001 [P] [US1] Add number normalisation and validation with tests in `api/src/modules/sms/sms-number.util.ts`
- [x] T002 [US1] Add `SmsService.send` in `api/src/modules/sms/sms.service.ts`, covering idempotency, retry rules and error mapping
- [x] T003 [US1] Test T002 against every documented response in `api/src/modules/sms/sms.service.spec.ts`
- [x] T004 [US1] Add `api/src/modules/sms/sms.module.ts` and register it
- [x] T005 [US1] Add `POST /api/v1/backoffice/sms/test` in `api/src/modules/backoffice/backoffice.controller.ts`
- [x] T006 [P] [US1] Add SMS settings in `client/src/components/admin/SmsSettings.tsx`, shown in Platform Backoffice
- [x] T007 [US1] Add the test send form and its tests in `client/src/components/admin/SmsTestForm.tsx`
- [x] T008 [P] [US1] Document the settings in `deploy/dokploy.env.example`
- [x] T009 [US1] Confirm the key is absent from client bundles, responses and logs
- [ ] T010 [US1] Run a real test send using `quickstart.md`

**Checkpoint**: an admin can configure SMS and send a test.

## Phase 2: Decisions Required (Deferred: SMS is Mako-only for now)

- [ ] T011 Answer Q1 (use cases) and Q2 (who pays) in `spec.md`
- [ ] T012 Ask Trinolux about Q3 (delivery status) and Q4 (message length)

## Phase 3: Send to a Lead (Deferred)

- [ ] T013 [US2] Add the `sms_messages` entity and migration
- [ ] T014 [US2] Add the send endpoint with tenant, permission and allowance checks
- [ ] T015 [US2] Add composer and history to the lead view
- [ ] T016 [US2] Update the privacy policy and data deletion handling

## Phase 4: Delivery Status (Deferred)

- [ ] T017 [US3] Implement status updates using the method Trinolux confirms
- [ ] T018 [US3] Show final status in message history
