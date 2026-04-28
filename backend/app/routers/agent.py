from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Optional

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.config import settings
from app.models.user import CurrentUser, UserRole
from app.services import get_data_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])

_SNOWHOUSE_HOST = "sfcogsops-snowhouse-aws-us-west-2.snowflakecomputing.com"
_AGENT_RUN_URL = f"https://{_SNOWHOUSE_HOST}/api/v2/cortex/agent:run"
_ORCHESTRATION_MODEL = "auto"

_TOOLS = [
    {"tool_spec": {"name": "BookManager_Data_Assistant", "type": "cortex_analyst_text_to_sql"}},
    {"tool_spec": {"name": "Sales_Knowledge_Assistant", "type": "cortex_search"}},
    {"tool_spec": {"name": "Snowflake_Docs_Assistant", "type": "cortex_search"}},
]

_TOOL_RESOURCES = {
    "BookManager_Data_Assistant": {
        "semantic_model_file": "@TEMP.JUSDAVIS.BKMNG_STAGE/bookmanager_assistant.yaml",
        "execution_environment": {"type": "warehouse", "warehouse": "SE_XS_WH"},
    },
    "Sales_Knowledge_Assistant": {
        "name": "SALES.KNOWLEDGE_ASSISTANT.FILE_SEARCH_SERVICE_PAGENUM_PROD",
        "Max_results": "5",
        "Title_column": "SEISMIC_LINK",
        "ID_column": "SEISMIC_LINK",
    },
    "Snowflake_Docs_Assistant": {
        "name": "CORTEX_KNOWLEDGE_EXTENSION_SNOWFLAKE_DOCUMENTATION.SHARED.CKE_SNOWFLAKE_DOCS_SERVICE",
        "Max_results": "5",
        "Title_column": "SOURCE_URL",
        "ID_column": "SOURCE_URL",
    },
}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    account_id: Optional[str] = None


def _ace_filter(user: CurrentUser) -> Optional[str]:
    return user.email if user.role == UserRole.ACE else None


def _acem_filter(user: CurrentUser) -> Optional[str]:
    return user.email if user.role == UserRole.ACEM else None


def _build_auth_headers() -> dict[str, str]:
    pat = settings.snowflake_pat
    if not pat:
        raise RuntimeError("SNOWFLAKE_PAT not configured")
    return {
        "Authorization": f"Bearer {pat}",
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }


def _build_agent_body(
    messages: list[dict],
    system_context: str,
    account_id: Optional[str] = None,
    account_name: Optional[str] = None,
) -> dict:
    api_messages = []
    for m in messages:
        if m.get("role") == "system":
            continue
        api_messages.append({
            "role": m["role"],
            "content": [{"type": "text", "text": m.get("content", "")}],
        })

    scoped = bool(account_id and account_name)
    system_instr = (
        "You are ACE — the Account Consumption Engineer. You are an expert Snowflake field SE "
        "for this customer, with deep knowledge of their consumption, use cases, people, "
        "signals, and history. Respond like a veteran SE: concrete numbers, named people, "
        "specific dates. No fluff. Use markdown. When you cite search results, include the source link."
    )
    if scoped:
        system_instr = (
            f"You are ACE — the Account Consumption Engineer for {account_name}. "
            f"You live and breathe this account. You know its consumption, use cases, champions, "
            f"signals, competitive situation, and history. When you answer, answer like a veteran SE "
            f"who owns this account: concrete numbers, named people, specific dates, next best actions. "
            f"No fluff. Use markdown. Cite sources with inline links when using search results."
        )

    orchestration_instr = (
        "Tool selection rules:\n"
        "- BookManager_Data_Assistant: specific-account data, use cases, signals, consumption, "
        "MEDDPICC, revenue, go-live dates, forecasts — anything from BookManager tables.\n"
        "- Snowflake_Docs_Assistant: Snowflake product docs, feature how-to, SQL syntax, API references.\n"
        "- Sales_Knowledge_Assistant: Seismic content, sales plays, competitive intel, pitch materials."
    )
    if scoped:
        orchestration_instr = (
            f"CURRENT SCOPE: User is viewing the account '{account_name}' (ACCOUNT_ID='{account_id}').\n"
            f"DEFAULT SCOPE RULE: Filter every BookManager_Data_Assistant query to ACCOUNT_ID = '{account_id}'. "
            f"Interpret pronouns (\"this account\", \"they\", \"them\", \"the customer\") as {account_name}. "
            f"ONLY drop the account filter when the user's intent is unambiguously global — explicit phrases "
            f"like \"across my book\", \"all accounts\", \"compare accounts\", \"how many accounts\", "
            f"or naming a different account. Never invent other accounts' data.\n\n"
            "Tool selection rules:\n"
            "- BookManager_Data_Assistant: account-specific data (scoped above), use cases, signals, "
            "consumption, MEDDPICC, revenue, go-live dates.\n"
            "- Snowflake_Docs_Assistant: Snowflake product docs, features, SQL syntax, how-to, APIs. NOT account-scoped.\n"
            "- Sales_Knowledge_Assistant: Seismic content, sales plays, competitive intel. NOT account-scoped."
        )

    return {
        "messages": api_messages,
        "models": {"orchestration": _ORCHESTRATION_MODEL},
        "instructions": {
            "system": system_instr,
            "response": (
                "Respond concisely using markdown. Lead with the answer. Cite sources with inline links. "
                "For data questions, reference the SQL results with real numbers. "
                "For knowledge questions, reference the document source."
            ),
            "orchestration": orchestration_instr,
        },
        "orchestration": {
            "budget": {"seconds": 60, "tokens": 16000},
        },
        "tools": _TOOLS,
        "tool_resources": _TOOL_RESOURCES,
        "stream": True,
    }


async def _stream_agent_run(
    messages: list[dict],
    data,
    ace_filter: Optional[str] = None,
    acem_filter: Optional[str] = None,
    account_id: Optional[str] = None,
    user_email: str = "",
) -> AsyncIterator[str]:
    system_context = ""
    try:
        system_context = data.get_bookmanager_context(
            user_email=user_email,
            ace_filter=ace_filter,
            acem_filter=acem_filter,
            account_id=account_id,
        )
    except Exception:
        system_context = "BookManager context unavailable."

    account_name: Optional[str] = None
    if account_id:
        try:
            account_name = data.get_account_name(account_id)
        except Exception:
            account_name = None

    body = _build_agent_body(messages, system_context, account_id=account_id, account_name=account_name)
    if system_context:
        body["messages"].insert(0, {
            "role": "user",
            "content": [{"type": "text", "text": f"[System context — do not repeat verbatim]\n{system_context}"}],
        })
        body["messages"].insert(1, {
            "role": "assistant",
            "content": [{"type": "text", "text": "Understood. I have the account context loaded. How can I help?"}],
        })

    if account_id and account_name and body["messages"]:
        for i in range(len(body["messages"]) - 1, -1, -1):
            if body["messages"][i]["role"] == "user":
                orig = body["messages"][i]["content"][0]["text"]
                if not orig.startswith("[Context:") and not orig.startswith("[System context"):
                    body["messages"][i]["content"][0]["text"] = (
                        f"[Context: on {account_name} account page — scope to ACCOUNT_ID='{account_id}' unless question is unambiguously book-wide]\n{orig}"
                    )
                break

    headers = _build_auth_headers()

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0)) as client:
            async with client.stream("POST", _AGENT_RUN_URL, json=body, headers=headers) as response:
                if response.status_code != 200:
                    error_body = ""
                    async for chunk in response.aiter_text():
                        error_body += chunk
                        if len(error_body) > 2000:
                            break
                    logger.error("Agent API error %s: %s", response.status_code, error_body[:500])
                    yield f"data: {json.dumps({'error': f'Agent API returned {response.status_code}'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                current_event = None
                buffer = ""
                async for raw_chunk in response.aiter_text():
                    buffer += raw_chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.rstrip("\r")

                        if not line:
                            current_event = None
                            continue

                        if line.startswith("event: "):
                            current_event = line[7:].strip()
                            continue

                        if not line.startswith("data: "):
                            continue

                        raw_data = line[6:]

                        if current_event == "response.text.delta":
                            try:
                                payload = json.loads(raw_data)
                                text = payload.get("text", "")
                                if text:
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                            except json.JSONDecodeError:
                                pass

                        elif current_event == "response.text.annotation":
                            try:
                                payload = json.loads(raw_data)
                                ann = payload.get("annotation", {})
                                if ann.get("type") == "cortex_search_citation":
                                    link_data = {
                                        "link": {
                                            "url": ann.get("doc_title", ""),
                                            "title": ann.get("doc_title", ""),
                                            "excerpt": ann.get("text", ""),
                                        }
                                    }
                                    yield f"data: {json.dumps(link_data)}\n\n"
                            except json.JSONDecodeError:
                                pass

                        elif current_event == "response.tool_result":
                            try:
                                payload = json.loads(raw_data)
                                tr = payload.get("tool_result") or payload
                                content = tr.get("content") or []
                                for item in content:
                                    j = item.get("json") if isinstance(item, dict) else None
                                    if not isinstance(j, dict):
                                        continue
                                    sql_text = j.get("sql") or j.get("generated_sql")
                                    if sql_text:
                                        yield f"data: {json.dumps({'sql': sql_text, 'verified': bool(j.get('verified_query_used'))})}\n\n"
                                        break
                            except json.JSONDecodeError:
                                pass

                        elif current_event == "response":
                            yield "data: [DONE]\n\n"
                            return

                        elif current_event == "error":
                            try:
                                payload = json.loads(raw_data)
                                msg = payload.get("message", "Agent error")
                                yield f"data: {json.dumps({'error': msg})}\n\n"
                            except json.JSONDecodeError:
                                yield f"data: {json.dumps({'error': 'Agent error'})}\n\n"
                            yield "data: [DONE]\n\n"
                            return

                yield "data: [DONE]\n\n"

    except httpx.TimeoutException:
        yield f"data: {json.dumps({'error': 'Agent request timed out. Please try again.'})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.exception("Agent stream error")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


async def _stream_fallback(
    messages: list[dict],
    data,
    ace_filter: Optional[str] = None,
    acem_filter: Optional[str] = None,
    account_id: Optional[str] = None,
    user_email: str = "",
) -> AsyncIterator[str]:
    try:
        if not hasattr(data, "_cursor"):
            yield f"data: {json.dumps({'text': 'Chat is not available.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        user_question = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
        )

        system_context = ""
        try:
            system_context = data.get_bookmanager_context(
                user_email=user_email,
                ace_filter=ace_filter,
                acem_filter=acem_filter,
                account_id=account_id,
            )
        except Exception:
            pass

        analyst_result: dict = {}
        if hasattr(data, "call_cortex_analyst") and user_question:
            try:
                analyst_result = await asyncio.to_thread(
                    data.call_cortex_analyst,
                    user_question,
                    None if account_id else ace_filter,
                    account_id if account_id else None,
                )
            except Exception:
                analyst_result = {}

        def _call_cortex():
            cur = data._cursor()
            if analyst_result.get("data"):
                rows_text = json.dumps(analyst_result["data"], default=str)
                if len(rows_text) > 8000:
                    rows_text = rows_text[:8000] + "...]"
                sql_note = ""
                if analyst_result.get("sql"):
                    sql_note = f"SQL used: {analyst_result['sql']}\n\n"
                prompt = (
                    "You are ACE, the AI assistant for BookManager.\n"
                    f"{sql_note}"
                    f"Database results:\n{rows_text}\n\n"
                    f"User: {user_question}\n"
                    "Answer concisely using the database results.\nACE:"
                )
            else:
                parts: list[str] = [
                    "You are ACE, the AI assistant for BookManager."
                ]
                if system_context:
                    parts.append(system_context)
                for msg in messages:
                    role = msg.get("role", "user")
                    content = (msg.get("content") or "").strip()
                    if role == "system":
                        parts.append(content)
                    elif role == "user":
                        parts.append(f"\nUser: {content}")
                    elif role == "assistant":
                        parts.append(f"\nACE: {content}")
                parts.append("\nACE:")
                prompt = "\n".join(parts)
            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', %s) AS response",
                (prompt,),
            )
            row = cur.fetchone()
            return (row or {}).get("RESPONSE") or ""

        text = await asyncio.to_thread(_call_cortex)
        if text:
            response = text.strip()
            for prefix in ["ACE:", "ace:"]:
                if response.lower().startswith(prefix.lower()):
                    response = response[len(prefix):].strip()
            yield f"data: {json.dumps({'text': response})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    data=Depends(get_data_service),
) -> StreamingResponse:
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    if settings.snowflake_pat:
        stream = _stream_agent_run(
            messages,
            data,
            ace_filter=_ace_filter(user),
            acem_filter=_acem_filter(user),
            account_id=req.account_id,
            user_email=user.email,
        )
    else:
        stream = _stream_fallback(
            messages,
            data,
            ace_filter=_ace_filter(user),
            acem_filter=_acem_filter(user),
            account_id=req.account_id,
            user_email=user.email,
        )

    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
