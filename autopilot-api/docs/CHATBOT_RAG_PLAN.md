# AI Chatbot & RAG Integration Plan

**Product:** Mako Co-pilot / Mako  
**Status:** Implemented (Phases 0–3)  
**Last updated:** 2026-06-09  

This document describes how to add tenant-aware, Brand Brain–powered chatbots with document RAG, an admin console, and an embeddable website widget—built on the existing NestJS API, React client, Mistral AI layer, and BullMQ job infrastructure.

---

## Executive summary

Mako Co-pilot already has:

- **Brand Brain** (`brand_profiles`) — structured tenant knowledge (voice, FAQs, offers, guardrails)
- **Document parsing** — PDF/DOCX/TXT → one-shot Mistral extraction into Brand Brain fields (not persisted as a knowledge base)
- **Mistral integration** — `MistralChatService`, usage tracking, subscription limits
- **Messaging patterns** — WhatsApp flows, social inbox, auto-reply rules (keyword + AI)
- **Multi-tenancy** — `tenantId` on most entities, RBAC, subscription gating

What is missing for chatbots:

- Persistent **knowledge documents** + **vector retrieval**
- **Chat sessions** and **conversation memory**
- **Public embed API** + lightweight **widget**
- **Streaming** responses and unified **RAG orchestration**

The recommended approach: add a `chatbot` module that composes Brand Brain (always-in-context) with pgvector-backed document chunks (retrieved per query), exposed via authenticated admin chat and a public widget secured by per-tenant API keys.

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           External websites / apps                          │
│   <script src="https://cdn.autopilot.app/widget.js"                        │
│           data-tenant-key="pk_live_..."></script>                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS (public widget API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  autopilot-client                                                           │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ Brand Brain  │  │ Chatbot Admin   │  │ Knowledge Library (new)        │  │
│  │ (existing)   │  │ sessions, test  │  │ upload PDF/DOCX, status      │  │
│  └──────────────┘  └─────────────────┘  └──────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Embeddable widget (iframe or shadow-DOM bundle) — optional in-app demo │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ JWT (admin) / Widget token (public)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  autopilot-api (NestJS)                                                     │
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │ ChatbotModule   │───▶│ RagOrchestrator  │───▶│ MistralChatService      │ │
│  │ sessions/messages│    │ retrieve + prompt│    │ (stream + complete)    │ │
│  └────────┬────────┘    └────────┬─────────┘    └─────────────────────────┘ │
│           │                      │                                          │
│           │           ┌──────────┴──────────┐                               │
│           │           ▼                     ▼                               │
│           │   ┌───────────────┐    ┌──────────────────┐                   │
│           │   │ BrandProfiles │    │ VectorStore      │                   │
│           │   │ (structured)  │    │ (pgvector)       │                   │
│           │   └───────────────┘    └──────────────────┘                   │
│           │                      ▲                                        │
│           │           ┌──────────┴──────────┐                               │
│           └──────────▶│ KnowledgeIngest   │◀── BullMQ `ai` / `ingest`   │
│                       │ chunk + embed     │                               │
│                       └───────────────────┘                               │
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐   │
│  │ TenantGuard     │  │ AiUsageTracker   │  │ SupabaseStorage (files) │   │
│  │ RBAC            │  │ Subscriptions    │  │ (existing)              │   │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              PostgreSQL        Redis (BullMQ)   Mistral API
              + pgvector        job queues       embeddings + chat
```

### Core design principles

| Principle | Approach |
|-----------|----------|
| Brand Brain first | Structured profile injected on every turn via existing `PromptBuilderService.brandContextBlock()` |
| Documents augment | Uploaded files chunked, embedded, retrieved only when query-relevant |
| Tenant isolation | Every row keyed by `tenantId`; vector search always filtered by `tenant_id` |
| Two surfaces | **Admin chat** (JWT + RBAC) and **Public widget** (scoped publishable key) |
| Async ingestion | Large documents processed via queue; chat never blocks on indexing |
| Reuse infra | BullMQ, `AiUsageTrackerService`, `ParseDocumentService` text extraction, audit logs |

### Relationship to existing features

| Existing | Chatbot reuse |
|----------|----------------|
| `brand_profiles` | Primary system prompt context; optionally link `brandProfileId` on bot config |
| `parse-document.service.ts` | Text extraction for ingestion pipeline |
| `whatsapp-auto-reply` / `social-dm-auto-reply` | Same RAG orchestrator can power channel bots later |
| `auto_reply_rules` | Widget can optionally use keyword rules before LLM (cost saving) |
| `ContactForm` embed | Pattern for public iframe; widget replaces/extends lead capture |

---

## 2. Database schema recommendations

### New tables

#### `chatbot_configs` (one per tenant, or per workspace/bot)

```sql
CREATE TABLE chatbot_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_profile_id  UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  name              VARCHAR(120) NOT NULL DEFAULT 'Website Assistant',
  welcome_message   TEXT,
  system_prompt_extra TEXT,           -- tenant overrides on top of Brand Brain
  model             VARCHAR(64) DEFAULT 'mistral-small-latest',
  temperature       REAL DEFAULT 0.3,
  max_context_messages INT DEFAULT 20,
  rag_enabled       BOOLEAN DEFAULT true,
  rag_top_k         INT DEFAULT 6,
  rag_min_score     REAL DEFAULT 0.72,
  widget_enabled    BOOLEAN DEFAULT false,
  widget_theme      JSONB,            -- colors, position, avatar
  allowed_origins   TEXT[],           -- CORS for widget
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id)                  -- v1: one bot per tenant; v2: drop for multi-bot
);
```

#### `chatbot_api_keys` (public widget auth)

```sql
CREATE TABLE chatbot_api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id   UUID NOT NULL REFERENCES chatbot_configs(id) ON DELETE CASCADE,
  key_prefix  VARCHAR(16) NOT NULL,   -- e.g. pk_live_abc123 (display only)
  key_hash    VARCHAR(128) NOT NULL,  -- bcrypt/sha256 of full secret
  label       VARCHAR(80),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chatbot_keys_prefix ON chatbot_api_keys(key_prefix) WHERE revoked_at IS NULL;
```

#### `knowledge_documents`

```sql
CREATE TABLE knowledge_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  uploaded_by   UUID NOT NULL,
  title         VARCHAR(255) NOT NULL,
  source_type   VARCHAR(32) NOT NULL,  -- upload | brand_sync | url
  mime_type     VARCHAR(128),
  storage_url   TEXT,                  -- Supabase path
  file_size_bytes BIGINT,
  status        VARCHAR(32) DEFAULT 'pending',  -- pending | processing | ready | failed
  error_message TEXT,
  chunk_count   INT DEFAULT 0,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_knowledge_docs_tenant ON knowledge_documents(tenant_id, status);
```

#### `knowledge_chunks` (with pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  document_id   UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index   INT NOT NULL,
  content       TEXT NOT NULL,
  token_count   INT,
  embedding     vector(1024),         -- match Mistral embedding model dim
  metadata      JSONB,                -- page, section heading, etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chunks_tenant_doc ON knowledge_chunks(tenant_id, document_id);
CREATE INDEX idx_chunks_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Partition option at scale: LIST (tenant_id) for large deployments
```

#### `chat_sessions`

```sql
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  config_id       UUID NOT NULL REFERENCES chatbot_configs(id),
  channel         VARCHAR(32) NOT NULL,  -- admin | widget | api
  visitor_id      VARCHAR(64),           -- anonymous cookie fingerprint (widget)
  user_id         UUID,                  -- logged-in admin user
  title           VARCHAR(255),
  metadata        JSONB,                 -- page URL, UTM, user agent
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chat_sessions_tenant ON chat_sessions(tenant_id, last_message_at DESC);
```

#### `chat_messages`

```sql
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            VARCHAR(16) NOT NULL,   -- user | assistant | system
  content         TEXT NOT NULL,
  citations       JSONB,                -- [{documentId, chunkId, excerpt}]
  tokens_used     INT,
  model           VARCHAR(64),
  latency_ms      INT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

### Optional: Brand Brain snapshot for RAG

For very large FAQs/case studies, optionally sync structured Brand Brain fields into `knowledge_chunks` with `source_type = 'brand_sync'` so retrieval can pull granular FAQ lines—not only the monolithic profile block.

### Migration strategy

- Add migration `1717920000016-ChatbotRag.ts`
- Enable `pgvector` on production Postgres (Supabase supports it)
- No changes to existing `brand_profiles` schema required for v1

---

## 3. Knowledge ingestion & document processing workflow

```
Upload (admin UI)
    │
    ▼
POST /api/v1/knowledge/documents
    │  • validate tenant + RBAC (settings.brand_brain or new chatbot.manage)
    │  • store file in Supabase: tenants/{tenantId}/knowledge/{docId}
    │  • insert knowledge_documents status=pending
    │
    ▼
Enqueue JOB_INGEST_DOCUMENT (BullMQ, per-tenant job id)
    │
    ▼
IngestDocumentProcessor
    1. Download file from storage
    2. extractText() — reuse ParseDocumentService (PDF/DOCX/TXT)
    3. Clean & normalize (strip boilerplate, fix encoding)
    4. Chunk — recursive splitter (~512 tokens, 80 token overlap)
    5. For each batch of chunks:
         • Mistral Embeddings API (or `mistral-embed`)
         • INSERT knowledge_chunks with tenant_id
    6. Update document status=ready, chunk_count
    7. On failure: status=failed, error_message
```

### Supported formats (v1)

| Format | Library (existing) |
|--------|-------------------|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| TXT / MD | native |

### v2 formats

- CSV (row-based chunks), HTML (Cheerio), URL crawl (reuse `scrape-website` patterns)

### Re-ingestion

- Document update → delete chunks by `document_id`, re-queue ingest
- Brand Brain save → optional debounced `brand_sync` job to refresh FAQ/offer chunks

### Limits (configurable per plan)

| Plan | Max documents | Max total MB | Max chunks |
|------|---------------|--------------|------------|
| Free | 3 | 10 MB | 500 |
| Starter | 25 | 100 MB | 5,000 |
| Pro | 100 | 1 GB | 50,000 |

---

## 4. RAG strategy

### Context assembly (per user message)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SYSTEM LAYER (always)                                    │
│    • chatbot_configs.system_prompt_extra                    │
│    • Brand Brain via brandContextBlock() — full structured  │
│    • Guardrails: bannedWords, bannedTopics                    │
│    • Instruction: cite sources when using document context  │
├─────────────────────────────────────────────────────────────┤
│ 2. RETRIEVED LAYER (if rag_enabled)                         │
│    • Embed user query (same model as ingestion)               │
│    • Vector search:                                           │
│        SELECT ... FROM knowledge_chunks                       │
│        WHERE tenant_id = $1                                   │
│        ORDER BY embedding <=> $query_embedding                │
│        LIMIT top_k                                            │
│    • Filter by rag_min_score (cosine similarity)            │
│    • Optional: hybrid BM25 (Postgres full-text) for keywords  │
├─────────────────────────────────────────────────────────────┤
│ 3. CONVERSATION LAYER                                       │
│    • Last N messages from chat_messages (sliding window)    │
│    • Summarize older turns if token budget exceeded (v2)      │
├─────────────────────────────────────────────────────────────┤
│ 4. USER MESSAGE                                             │
└─────────────────────────────────────────────────────────────┘
```

### Retrieval parameters (defaults)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Chunk size | ~512 tokens | ~2,000 chars |
| Overlap | 80 tokens | Preserves sentence boundaries |
| top_k | 6 | Tunable per bot |
| min_score | 0.72 | Drop low-relevance chunks |
| Embedding model | `mistral-embed` | 1024-dim; align with DB column |

### When Brand Brain alone is enough

Skip retrieval (or reduce top_k) when:

- User message is generic greeting ("hi", "hello")
- Keyword rules match a static template response (optional pre-LLM layer)

### Citation format

Assistant responses include structured `citations` in `chat_messages`:

```json
[
  { "documentId": "...", "title": "Pricing Guide.pdf", "excerpt": "..." }
]
```

Widget UI shows collapsible "Sources" under assistant bubbles.

### Evaluation (ongoing)

- Golden Q&A set per tenant (admin uploads test questions)
- Log retrieval scores + answer grounding for regression testing

---

## 5. Tenant isolation & security

### Data isolation

| Layer | Control |
|-------|---------|
| Database | `tenant_id` on all chat/RAG tables; FK to `tenants` |
| Vector search | **Mandatory** `WHERE tenant_id = $tenant` in every query |
| Storage | Supabase path prefix `tenants/{tenantId}/` |
| Sessions | `session.tenant_id` must match key/config tenant |

### Authentication surfaces

| Surface | Auth | Scope |
|---------|------|-------|
| Admin chat API | JWT + `TenantGuard` + RBAC `chatbot.use` | Full session history for tenant |
| Knowledge admin | JWT + `chatbot.manage` | Upload/delete documents |
| Widget API | `Authorization: Bearer pk_live_...` | Create session, send message only |
| Widget origin | `allowed_origins` on config + CORS | Block unauthorized domains |

### API key handling

- Generate `pk_live_<random>`; store only hash server-side
- Rotate/revoke via admin UI
- Rate limit per key: 60 req/min IP, 20 messages/min session (Redis)

### PII & compliance

- Do not log full message bodies in application logs (metadata only)
- Retention policy: auto-delete widget sessions after 90 days (configurable)
- Export/delete tenant data includes `chat_*` and `knowledge_*` tables
- Prompt injection mitigation: system prompt hardening, retrieved content in XML delimiters, output filtering for banned topics

### Hardening existing gaps (prerequisite)

Before public widget launch:

- Apply `TenantGuard` + membership check on all tenant-scoped routes
- Lock down unauthenticated `ai-usage` and `auto-reply-rules` CRUD
- Ensure `brand-profiles` list requires `tenantId` filter

---

## 6. Widget embedding architecture

### Delivery options

| Option | Pros | Cons |
|--------|------|------|
| **A. Script loader + Shadow DOM** (recommended) | Lightweight, style isolation, easy CDN | Slightly more JS |
| B. iframe to `/embed/chat?key=` | Strongest isolation | Harder mobile UX, height resize |

### Recommended embed snippet

```html
<script
  async
  src="https://cdn.autopilot.app/widget/v1/loader.js"
  data-key="pk_live_xxxxxxxx"
  data-position="bottom-right"
  data-theme="auto"
></script>
```

### Widget loader flow

```
loader.js (static, CDN)
    │
    ├─ Reads data-key, injects shadow root
    ├─ Fetches widget config: GET /api/v1/widget/config (public key)
    │     → welcome message, theme, bot name
    │
    ├─ Creates/resumes session: POST /api/v1/widget/sessions
    │     → sets HttpOnly cookie `ap_visitor` for continuity
    │
    └─ Chat UI bundle (React preact, ~40–60kb gzip)
          POST /api/v1/widget/sessions/:id/messages
          SSE GET  /api/v1/widget/sessions/:id/stream (v1.1)
```

### CORS

```
Access-Control-Allow-Origin: <matched allowed_origins>
Access-Control-Allow-Credentials: true
```

### Mobile & accessibility

- Responsive sheet on mobile (full-width bottom drawer)
- `aria-live` for new messages, keyboard navigation, focus trap in open state
- Reduced motion preference respected

### Build pipeline

- New package: `autopilot-widget/` (Vite library mode)
- Published to CDN on release; versioned URL `widget/v1/`
- Separate from main `autopilot-client` bundle

---

## 7. Recommended AI models & infrastructure

### Models (Mistral — already integrated)

| Use case | Model | Notes |
|----------|-------|-------|
| Chat (default) | `mistral-small-latest` | Fast, cost-effective |
| Chat (premium tier) | `mistral-large-latest` | Pro plan option |
| Embeddings | `mistral-embed` | 1024 dimensions |
| JSON / tools (v2) | `mistral-small` + function calling | Lead capture, booking |

### Infrastructure

| Component | Recommendation |
|-----------|----------------|
| API | Existing NestJS on Node 20+ |
| Queue | BullMQ + Redis (reuse `QUEUE_AI` or new `QUEUE_INGEST`) |
| Vector DB | **pgvector** in existing Postgres (simplest ops) |
| File storage | Supabase Storage (already used) |
| CDN | Cloudflare / Supabase CDN for widget static assets |
| Streaming | SSE from NestJS (`@Sse()` or raw `res.write`) |
| Caching | Redis: embed query cache (5 min TTL), config cache |

### Scale path

| Stage | Architecture |
|-------|--------------|
| < 100 tenants | Single Postgres + pgvector IVFFlat |
| 100–1k tenants | Dedicated embedding worker pool; tune IVFFlat lists |
| 1k+ tenants | Consider Qdrant/Pinecone; or partition `knowledge_chunks` by tenant |

### Cost controls

- Count widget messages against `ai_usage` (`functionName: 'chatbot-message'`)
- Plan limits: Free 50 widget msgs/mo, Starter 500, Pro unlimited
- Cache embeddings for identical queries within session

---

## 8. API design & key endpoints

### Admin APIs (JWT)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/chatbot/config?tenantId=` | Get bot config |
| `PATCH` | `/api/v1/chatbot/config` | Update welcome, theme, RAG settings |
| `POST` | `/api/v1/chatbot/config/keys` | Create widget API key |
| `DELETE` | `/api/v1/chatbot/config/keys/:id` | Revoke key |
| `GET` | `/api/v1/chatbot/sessions?tenantId=` | List sessions (admin) |
| `GET` | `/api/v1/chatbot/sessions/:id/messages` | Transcript |
| `POST` | `/api/v1/chatbot/sessions` | Start admin test session |
| `POST` | `/api/v1/chatbot/sessions/:id/messages` | Send message (sync or SSE) |
| `DELETE` | `/api/v1/chatbot/sessions/:id` | Delete session |
| `GET` | `/api/v1/knowledge/documents?tenantId=` | List documents |
| `POST` | `/api/v1/knowledge/documents` | Upload (multipart) |
| `DELETE` | `/api/v1/knowledge/documents/:id` | Remove doc + chunks |
| `POST` | `/api/v1/knowledge/documents/:id/reindex` | Re-ingest |

### Public widget APIs (API key)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/widget/config` | Public bot metadata + theme |
| `POST` | `/api/v1/widget/sessions` | Create anonymous session |
| `POST` | `/api/v1/widget/sessions/:id/messages` | User message → assistant reply |
| `GET` | `/api/v1/widget/sessions/:id/stream` | SSE token stream (v1.1) |

### Example: send message (widget)

```http
POST /api/v1/widget/sessions/abc-123/messages
Authorization: Bearer pk_live_xxxxxxxx
Content-Type: application/json

{
  "content": "What are your pricing plans?",
  "metadata": { "pageUrl": "https://example.com/pricing" }
}
```

```json
{
  "messageId": "...",
  "role": "assistant",
  "content": "We offer Free, Starter, and Pro plans...",
  "citations": [
    { "documentId": "...", "title": "Pricing.pdf", "excerpt": "Starter plan..." }
  ]
}
```

### RBAC permissions (new)

```typescript
chatbot: {
  view: 'chatbot.view',      // see sessions
  use: 'chatbot.use',        // test chat in admin
  manage: 'chatbot.manage',  // config, keys, documents
}
```

---

## 9. UI/UX recommendations

### Administrators

| Screen | Location | Features |
|--------|----------|----------|
| **Chatbot Settings** | `/settings/chatbot` or new `/chatbot` | Welcome msg, model, RAG toggles, theme preview |
| **Knowledge Library** | `/chatbot/knowledge` | Drag-drop upload, processing status, delete, reindex |
| **Test playground** | Split pane on settings | Live chat against current config |
| **Embed code** | Copy snippet + allowed origins | Like existing ContactForm embed in Settings |
| **Conversation log** | `/chatbot/sessions` | Search, filter widget vs admin, export CSV |
| **API keys** | Table with create/revoke | Show prefix only |

**UX patterns (match existing app):**

- Use `DashboardLayout`, shadcn cards, toast feedback
- Processing states: pending → processing → ready (badge + progress)
- Empty states with CTA to upload first document or complete Brand Brain

### End users (widget)

| Element | Recommendation |
|---------|----------------|
| Launcher | Floating button, brand primary color, subtle pulse on first visit |
| Panel | 380×560px desktop; bottom sheet on mobile |
| Messages | User right-aligned bubbles; assistant left with avatar |
| Sources | Collapsible chips under assistant messages |
| Input | Auto-grow textarea, Enter to send, Shift+Enter newline |
| Loading | Typing indicator (three dots) during RAG + LLM |
| Errors | Friendly fallback: "I'm having trouble—try again or contact us" |
| Offline | Queue message or show email fallback link |

### Brand alignment

- Pull `widget_theme` from config: `primaryColor`, `fontFamily`, `botName`, `avatarUrl`
- Default avatar: tenant initials or Brand Brain company logo (future)

---

## 10. Phased implementation roadmap

### Phase 0 — Foundations (1–2 weeks) — **Medium**

| Milestone | Deliverables |
|-----------|--------------|
| Security hardening | `TenantGuard` on tenant routes; fix open CRUD endpoints |
| Permissions | Add `chatbot.*` to RBAC |
| DB migration | `chatbot_configs`, `chat_sessions`, `chat_messages` (no RAG yet) |
| Brand-only chat | Admin test chat using `PromptBuilderService` + Mistral (no retrieval) |

**Complexity:** M — mostly wiring existing pieces.

---

### Phase 1 — Knowledge base & RAG (2–3 weeks) — **High**

| Milestone | Deliverables |
|-----------|--------------|
| pgvector setup | Extension + `knowledge_documents`, `knowledge_chunks` |
| Ingestion pipeline | Upload API, BullMQ processor, chunk + embed |
| RAG orchestrator | Retrieve + prompt assembly + citations |
| Knowledge Library UI | Upload list, status, delete |
| Usage metering | `chatbot-message`, `ingest-document` in `ai_usage` |

**Complexity:** H — new data plane, embedding batching, error handling.

---

### Phase 2 — Admin chat & sessions (1–2 weeks) — **Medium**

| Milestone | Deliverables |
|-----------|--------------|
| Session management | CRUD, message history, sliding window |
| Chat UI in app | `/chatbot` playground + session log viewer |
| Streaming (optional) | SSE for admin chat |
| Audit | `chatbot.session.created`, `knowledge.document.uploaded` |

**Complexity:** M

---

### Phase 3 — Embeddable widget (2–3 weeks) — **High**

| Milestone | Deliverables |
|-----------|--------------|
| API keys | Generate, revoke, rate limits |
| Widget bundle | Vite library, Shadow DOM, CDN deploy |
| Public widget API | CORS, origin allowlist, visitor sessions |
| Embed settings UI | Copy snippet, theme preview, domain whitelist |
| Load testing | 100 concurrent widget sessions |

**Complexity:** H — security boundary, CORS, CDN pipeline.

---

### Phase 4 — Polish & scale (2+ weeks) — **Medium–High**

| Milestone | Deliverables |
|-----------|--------------|
| Hybrid search | BM25 + vector |
| Brand Brain chunk sync | FAQ/offer auto-indexing |
| Channel unification | Route WhatsApp/social DMs through same RAG |
| Analytics | Deflection rate, top questions, citation usage |
| Lead capture tool | Bot collects email → `leads` table |
| Multi-bot per tenant | Drop unique constraint on `chatbot_configs` |

**Complexity:** M–H

---

### Total estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 | 1–2 wk | 2 wk |
| 1 | 2–3 wk | 5 wk |
| 2 | 1–2 wk | 7 wk |
| 3 | 2–3 wk | 10 wk |
| 4 | 2+ wk | 12+ wk |

**MVP (admin RAG chat + knowledge upload):** Phases 0–2 ≈ **6–7 weeks**  
**Full widget launch:** through Phase 3 ≈ **9–10 weeks**

---

## Appendix A — Module structure (NestJS)

```
src/modules/
  chatbot/
    chatbot.module.ts
    chatbot.controller.ts          # admin
    widget.controller.ts           # public
    chatbot-config.service.ts
    chat-session.service.ts
    rag-orchestrator.service.ts
    entities/
  knowledge/
    knowledge.module.ts
    knowledge.controller.ts
    ingest-document.service.ts
    vector-store.service.ts
    processors/
      ingest-document.processor.ts
```

## Appendix B — Reuse map

| Existing file | Reuse in chatbot |
|---------------|------------------|
| `parse-document.service.ts` | `extractText()` |
| `prompt-builder.service.ts` | `brandContextBlock()`, `replySystem()` |
| `mistral-chat.service.ts` | Chat + extend for streaming |
| `ai-usage-tracker.service.ts` | Gating + recording |
| `queue-dispatch.service.ts` | Ingest jobs |
| `supabase-storage.service.ts` | Document files |
| `DocumentUpload.tsx` | Pattern for Knowledge Library UI |

---

## Decision log (recommended defaults)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector store | pgvector | Already on Postgres; lowest ops burden |
| Embeddings | Mistral | Single vendor with chat |
| Widget isolation | Shadow DOM + API key | Balance of UX and security |
| Bots per tenant (v1) | One | Simpler; multi-bot in v2 |
| Brand profile scope | Tenant owner's profile for widget | Consistent with WhatsApp auto-reply today |
| Streaming | Phase 2 admin, Phase 3 widget | Reduces time-to-MVP |
| Knowledge retrieval (default) | Self-hosted RAG + Brand Brain | Tenant isolation, citations, no extra Mistral indexing cost |
| Mistral Libraries | Opt-in per tenant (`useMistralLibrary`) | Mistral owns indexing/search when you want it; dual-syncs uploads while keeping local RAG as fallback |

---

*End of document.*
