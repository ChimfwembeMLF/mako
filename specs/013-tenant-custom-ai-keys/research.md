# Research & Decisions

## Decision 1: AI Provider Routing
- **Decision**: Create an `AiProviderRouter` service that implements the standard AI methods (`complete`, `completeJson`, `speak`, `embed`). It will inspect the `TenantIntegrationConfig` to find the preferred AI provider for a given `tenantId`.
- **Rationale**: Currently, `MistralChatService` is hardcoded everywhere. By replacing injections of `MistralChatService` with `AiProviderRouter`, we can seamlessly support OpenAI, Gemini, and Deepseek in the future without changing the caller logic, as long as `tenantId` is passed correctly.
- **Alternatives considered**: Modifying `MistralChatService` to handle OpenAI calls (rejected, violates single responsibility principle).

## Decision 2: Usage Limits Bypass
- **Decision**: Update `AiUsageTrackerService.assertWithinLimit(tenantId, userId)` to accept a third parameter `bypassLimit: boolean = false`. The router or the caller will pass this flag if a custom key was successfully resolved.
- **Rationale**: Tenants using their own keys should not be constrained by the platform's AI token limits. Tracking should still occur for analytics.
- **Alternatives considered**: Stopping usage tracking entirely for BYOK tenants (rejected, breaks token analytics).

## Decision 3: Context Propagation (`tenantId`)
- **Decision**: Update all background job processors and AI feature services (`adapt-platforms.service.ts`, `generate-content.service.ts`, etc.) to explicitly pass the `tenantId` parameter into `completeJson` and `complete`.
- **Rationale**: Without `tenantId`, the router has no context to look up the custom keys, causing the fallback to global platform keys (which results in rate limits).
