# Mistral Workflows integration

Mako uses [Mistral Workflows](https://docs.mistral.ai/capabilities/workflows) for durable, multi-step background jobs. Synchronous widget chat stays in NestJS (`RagOrchestratorService`); workflows handle escalation, ingest pipelines, and other async orchestration.

## Project layout

```
mistralworkflow/          # Python workflows worker (scaffolded via mistralai-workflows-cli)
  src/workflows/          # Workflow definitions (auto-discovered by worker)
  src/entrypoints/        # worker.py, start.py (CLI trigger)
  .env                    # MISTRAL_API_KEY, DEPLOYMENT_NAME (gitignored)
```

## Setup

1. Create a dedicated workspace in [Mistral Console](https://console.mistral.ai/) and an API key.
2. Store credentials in `mistralworkflow/.env` (never commit):

```bash
MISTRAL_API_KEY=your-key
DEPLOYMENT_NAME=default
```

3. Install and run the worker:

```bash
cd mistralworkflow
uv sync
uv run python src/worker.py
```

4. Confirm workflows appear in **AI Studio → Workflows**.

## Workflows

| Name | Purpose |
|------|---------|
| `hello-world` | Scaffold smoke test |
| `support-escalation` | Classify urgency, summarize transcript, prepare support handoff |

### Trigger from CLI

```bash
cd mistralworkflow
uv run python src/entrypoints/start.py \
  --workflow support-escalation \
  --input '{"tenant_id":"...","session_id":"...","user_message":"I need a refund"}'
```

### Trigger from API

NestJS exposes escalation via the chatbot module when `MISTRAL_API_KEY` is set:

```
POST /api/v1/chatbot/sessions/:sessionId/escalate?tenantId=...
Body: { "userMessage": "...", "visitorEmail": "optional@example.com" }
```

Uses `MistralWorkflowsService` → `POST /v1/workflows/support-escalation/execute`.

Env:

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | Same key as chat/embed (workflows namespace from key) |
| `MISTRAL_WORKFLOWS_DEPLOYMENT_NAME` | Routes executions to a worker deployment (default: `default`) |
| `SUPPORT_EMAIL` | Default recipient for escalation notifications |

## Default system message

All tenants get a default `system_prompt_extra` on create and via migration `1717920000023`. Runtime also falls back through `resolveSystemPromptExtra()` if the field is blank.

## Adding a workflow

1. Add `src/workflows/my_workflow.py` with `@workflows.workflow.define(name="my-workflow")`.
2. Restart the worker (`uv run python src/worker.py`).
3. Call from NestJS via `MistralWorkflowsService.executeWorkflow({ workflowIdentifier: 'my-workflow', input: {...} })`.

See `mistralworkflow/.agents/skills/workflows/SKILL.md` for framework docs.
