"""Classify and summarize unresolved chatbot conversations for human follow-up."""

import json
import re
import uuid
from enum import Enum

import mistralai.workflows as workflows
import mistralai.workflows.plugins.mistralai as workflows_mistralai
from pydantic import BaseModel


class Urgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class SupportEscalationInput(BaseModel):
    tenant_id: str
    session_id: str
    bot_name: str = "Website Assistant"
    user_message: str
    transcript: str = ""
    support_email: str | None = None
    visitor_email: str | None = None


class EscalationDraft(BaseModel):
    urgency: Urgency
    subject: str
    summary: str
    suggested_reply: str


class SupportEscalationOutput(BaseModel):
    escalation_id: str
    urgency: Urgency
    subject: str
    summary: str
    suggested_reply: str
    notified_email: str | None = None


_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


@workflows.activity()
async def build_escalation_draft(input: SupportEscalationInput) -> EscalationDraft:
    """Use Mistral to classify urgency and draft a support handoff."""
    transcript = input.transcript.strip() or "(no prior messages)"
    prompt = f"""You are triaging a chatbot conversation that needs human support.

Bot name: {input.bot_name}
Tenant ID: {input.tenant_id}
Session ID: {input.session_id}
Visitor email: {input.visitor_email or "unknown"}

Latest user message:
{input.user_message}

Conversation transcript:
{transcript}

Respond with JSON only (no markdown), using this schema:
{{
  "urgency": "low" | "medium" | "high",
  "subject": "short email subject line",
  "summary": "2-4 sentence summary for the support team",
  "suggested_reply": "draft reply the human agent can send"
}}

Urgency guide:
- high: billing failure, outage, safety, angry customer, legal threat
- medium: order issue, bug report, needs account lookup
- low: general question the bot could not answer"""

    request = workflows_mistralai.ChatCompletionRequest(
        model="mistral-small-latest",
        messages=[workflows_mistralai.UserMessage(content=prompt)],
        response_format={"type": "json_object"},
    )
    response = await workflows_mistralai.mistralai_chat_complete(request)
    raw = response.choices[0].message.content or "{}"
    match = _JSON_BLOCK.search(raw)
    payload = json.loads(match.group(0) if match else raw)

    return EscalationDraft(
        urgency=Urgency(payload.get("urgency", "medium")),
        subject=str(payload.get("subject", "Chatbot escalation")).strip()[:200],
        summary=str(payload.get("summary", "")).strip(),
        suggested_reply=str(payload.get("suggested_reply", "")).strip(),
    )


@workflows.activity()
async def prepare_support_notification(
    support_email: str,
    draft: EscalationDraft,
    input: SupportEscalationInput,
) -> str:
    """Prepare escalation notification payload (email integration can plug in here)."""
    return (
        f"To: {support_email}\n"
        f"Subject: [{draft.urgency.value.upper()}] {draft.subject}\n"
        f"Session: {input.session_id}\n"
        f"Tenant: {input.tenant_id}\n\n"
        f"{draft.summary}\n\n"
        f"Suggested reply:\n{draft.suggested_reply}"
    )


@workflows.workflow.define(
    name="support-escalation",
    workflow_display_name="Support Escalation",
    workflow_description=(
        "Classify urgency and summarize unresolved chatbot conversations "
        "for human follow-up."
    ),
)
class SupportEscalationWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: SupportEscalationInput) -> SupportEscalationOutput:
        draft = await build_escalation_draft(input)
        notified_email: str | None = None

        if input.support_email:
            await prepare_support_notification(input.support_email, draft, input)
            notified_email = input.support_email

        return SupportEscalationOutput(
            escalation_id=str(uuid.uuid4()),
            urgency=draft.urgency,
            subject=draft.subject,
            summary=draft.summary,
            suggested_reply=draft.suggested_reply,
            notified_email=notified_email,
        )
