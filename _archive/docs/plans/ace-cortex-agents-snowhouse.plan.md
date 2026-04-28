# Plan: ACE Unified Agent via Cortex Agents API (Snowhouse)

## Overview
Replace the custom 3-phase CORTEX.COMPLETE planner with a single call to Snowflake's Cortex Agents REST API on Snowhouse. The agent natively orchestrates BookManager Cortex Analyst + Raven Cortex Search, returning structured citations with Seismic doc URLs. ACE becomes fully unified — no mode selector needed.

---

## What Was Wrong (Root Cause Analysis)

| Issue | Old code | Fix |
|---|---|---|
| Endpoint | `/api/v2/cortex/agents:run` (plural) | `/api/v2/cortex/agent:run` (singular) |
| `messages.content` | `"string"` | `[{"type":"text","text":"..."}]` |
| Model field | `"model": "llama3.1-70b"` | `"models": {"orchestration": "llama3.1-70b"}` |
| System message | In `messages[0]` as `role:system` | In `instructions.system` |
| Tool routing | Custom 3-phase Python planner | Native agent orchestration via `instructions.orchestration` |
| Doc links | Manual regex / none | `response.text.annotation` events with `doc_title = SEISMIC_LINK` |

---

## Task 1 — Fix agent.py: correct endpoint + request schema

**File:** `BookManager/backend/app/routers/agent.py`

Replace `_stream_agent()` / `_stream_cortex_code()` / mode routing with a single `_stream_agent_run()` that:

```python
async def _stream_agent_run(
    messages: list[dict],
    data,
    ace_filter: Optional[str] = None,
    account_id: Optional[str] = None,
    user_email: str = "",
) -> AsyncIterator[str]:
    # 1. Build instructions.system from get_bookmanager_context()
    system_ctx = data.get_bookmanager_context(...)
    
    # 2. Convert messages: content str → [{type, text}] array
    api_messages = [
        {"role": m["role"], "content": [{"type": "text", "text": m["content"]}]}
        for m in messages if m["role"] != "system"
    ]
    
    # 3. POST to correct endpoint
    url = "https://sfcogsops-snowhouse-aws-us-west-2.snowflakecomputing.com/api/v2/cortex/agent:run"
    body = {
        "messages": api_messages,
        "models": {"orchestration": "llama3.1-70b"},
        "instructions": {
            "system": system_ctx,
            "response": "Be concise. Use markdown for lists and code. Cite sources inline.",
            "orchestration": (
                "Use BookManager_Data_Assistant for questions about accounts, "
                "use cases, consumption, signals, and Snowflake field data. "
                "Use Sales_Knowledge_Assistant for Snowflake product knowledge, "
                "documentation, competitive intel, and general Snowflake questions."
            ),
        },
        "tools": [_BOOKMANAGER_TOOL, _RAVEN_SEARCH_TOOL],
        "tool_resources": {**_BOOKMANAGER_TOOL_RESOURCE, **_RAVEN_SEARCH_RESOURCE},
        "stream": True,
    }
    # Auth: same PAT used for connector, as Bearer token
    pat = data._settings.snowflake_pat  # or os.environ["SNOWFLAKE_PAT"]
    headers = {
        "Authorization": f'Snowflake Token="{pat}"',
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
```

**Tool resources (updated):**
```python
_RAVEN_SEARCH_RESOURCE = {
    "Sales_Knowledge_Assistant": {
        "name": "SALES.KNOWLEDGE_ASSISTANT.FILE_SEARCH_SERVICE_PAGENUM_PROD",
        "Max_results": 5,
        "Title_column": "SEISMIC_LINK",  # → doc_title in citations = URL
    }
}
```

---

## Task 2 — Parse new SSE event types in agent.py

The new API streams named events. Each SSE block looks like:
```
event: response.text.delta
data: {"content_index":0,"text":"Hello"}

event: response.text.annotation
data: {"content_index":0,"annotation_index":0,"annotation":{"type":"cortex_search_citation","doc_title":"https://...","text":"excerpt"}}

event: response
data: {"role":"assistant","content":[...]}
```

Parser logic:
```python
current_event = None
for line in response_lines:
    if line.startswith("event: "):
        current_event = line[7:].strip()
    elif line.startswith("data: "):
        payload = json.loads(line[6:])
        if current_event == "response.text.delta":
            yield f"data: {json.dumps({'text': payload['text']})}\n\n"
        elif current_event == "response.text.annotation":
            ann = payload.get("annotation", {})
            if ann.get("type") == "cortex_search_citation":
                yield f"data: {json.dumps({'link': {'url': ann['doc_title'], 'excerpt': ann['text']}})}\n\n"
        elif current_event == "response":
            yield "data: [DONE]\n\n"
            return
        elif current_event == "error":
            yield f"data: {json.dumps({'error': payload.get('message', 'Agent error')})}\n\n"
            yield "data: [DONE]\n\n"
            return
        current_event = None
```

---

## Task 3 — Update AIChatPanel.tsx

**Remove:** The 3-way mode selector (bookmanager / raven / cortex_code buttons).

**Add:** Citation accumulation + inline rendering:
- Accumulate `link` events into a `citations` array during streaming
- After streaming completes, render collected citations as a "Sources" section below the message
- Each citation: `[N] [doc_title as URL](url)` — since `doc_title` = Seismic URL (from `Title_column`)

**SSE client update:** Current parser looks for `data: ` lines only. Update to also track `event: ` lines before each data block so `[DONE]` is still recognized.

No other UI changes — keep code block rendering, keep "Ask ACE" floating button.

---

## Task 4 — BKMNG_USER_PREFERENCES table + API

**SQL:**
```sql
CREATE TABLE IF NOT EXISTS TEMP.JUSDAVIS.BKMNG_USER_PREFERENCES (
    USER_EMAIL    VARCHAR NOT NULL PRIMARY KEY,
    PREFERRED_NAME VARCHAR,
    GREETING_STYLE VARCHAR,       -- e.g. "Hi [Name]," / "Hello [Name],"
    CLOSING_STYLE  VARCHAR,       -- e.g. "Best, ACE" / "Warm regards, ACE"
    WRITING_EXAMPLES VARIANT,     -- array of example strings
    UPDATED_AT    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

**New file:** `backend/app/routers/user.py`
- `GET /api/user/preferences` → return user's row (or defaults)
- `PUT /api/user/preferences` → MERGE into table

**Register** in `main.py`.

**Frontend hooks** in `useApi.ts`: `useUserPreferences()`, `useUpdatePreferences()`.

---

## Task 5 — Settings page + sidebar link

**`bkmng-next/components/layout/Sidebar.tsx`:**
- Wrap the username display in a `<Link href="/settings">` tag
- Add a small settings cog icon next to the username

**`bkmng-next/app/settings/page.tsx`** (new file):
- Section: "Email Personalization"
  - Preferred name field (used in `ACE` signing off)
  - Greeting style (text input, e.g. "Hi [Name],")
  - Closing style (text input, e.g. "Best, ACE")
  - Writing examples (textarea, one per line — up to 3 examples of user's writing style)
- Save button → `useUpdatePreferences()` mutation
- Standard layout with page header

---

## Task 6 — TypeScript check + deploy

```bash
node_modules_darwin_backup/.bin/tsc --noEmit | grep -v graphql
```

If clean:
```bash
# Build linux/amd64 image
docker buildx build --platform linux/amd64 -t bkmng:latest -f Dockerfile.spcs .

# Login + push
snow spcs image-registry login --connection JDAVIS_AWS1
docker tag bkmng:latest sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com/bookmanager/demo/bkmng_repo/bkmng:latest
docker push sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com/bookmanager/demo/bkmng_repo/bkmng:latest

# Update service
snow sql -c JDAVIS_AWS1 -q "ALTER SERVICE BOOKMANAGER.DEMO.BKMNG_SERVICE FROM SPECIFICATION \$\$...\$\$"
```

---

## Key Technical Notes

- **Snowhouse account URL:** `sfcogsops-snowhouse-aws-us-west-2.snowflakecomputing.com`
- **PAT auth headers:** `Authorization: Snowflake Token="{PAT}"` + `X-Snowflake-Authorization-Token-Type: PROGRAMMATIC_ACCESS_TOKEN`
- **Citation URLs:** `Title_column: "SEISMIC_LINK"` → `doc_title` in annotations = full Seismic URL
- **No `role:system` in messages array** for the new API — use `instructions.system` instead
- **Stream detection:** `httpx.AsyncClient` or `aiohttp` for async streaming; use `stream=True` and iterate over lines
- **`response.tool_use`/`response.tool_result` events:** can skip or log — agent handles tool calls internally
- **Model:** `llama3.1-70b` confirmed on Snowhouse; agent will auto-select if not specified
