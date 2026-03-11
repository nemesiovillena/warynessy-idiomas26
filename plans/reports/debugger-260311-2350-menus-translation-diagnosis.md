# Menus Collection Translation Diagnosis

**Date:** 2026-03-11
**Severity:** HIGH
**Status:** Root cause identified

---

## Executive Summary

Menus 1-5 have no translations across `ca/en/fr/de` locales. Root cause is **Python translation agent not running** when those menus were saved/updated on 2026-03-11. The hook fires correctly but fails silently because `fetch()` to `localhost:8000` gets connection refused — it falls back to returning the original Spanish text, which then gets written as the "translation" for all locales.

---

## Test Results

### Scenario 1: Python Agent Reachability — FAILED (ROOT CAUSE)

```
curl -X POST http://localhost:8000/translate ...
→ HTTP_STATUS:000 / CONNECTION_ERROR: 7 (connection refused)
```

Agent is NOT running. `services/translation-agent/main.py` exists with a venv and `agent.log`, but process is stopped.

### Scenario 2: OpenRouter API Key — PASS

```
OPENROUTER_API_KEY=sk-or-v1-68092ab...  (present, correct format)
```

Key is configured in `.env`. No issue here.

### Scenario 3: ConfiguracionTraduccion Global State — CONFIGURED

```sql
SELECT id, modelo_i_a, endpoint_agente, proveedor_i_a FROM configuracion_traduccion;
→ 1 | anthropic/claude-3.5-sonnet | http://localhost:8000/translate | agente-python
```

Config exists and is populated correctly. Endpoint points to `localhost:8000` which is the correct address for local agent.

### Scenario 4: Database Translation Storage — PARTIALLY POPULATED

```sql
menus 1-5:  all 5 locales have IDENTICAL Spanish text ("Menú Típico Villenero", etc.)
menus 6-11: all 5 locales have REAL translations ("Thyme Menu", "Für die Kleinsten", etc.)
```

Total: 55 rows across 11 menus × 5 locales. 25 rows (menus 1-5) are Spanish copies in all locales.

### Scenario 5: Hook Execution — NOT TESTED (not needed)

Hook code is structurally correct. The `executeTranslations()` call is fire-and-forget (no `await`), so errors don't surface to the caller.

---

## Root Cause

**Primary:** Python translation agent (`services/translation-agent/main.py`) was not running when menus 1-5 were saved on 2026-03-11.

**Evidence:**
- `curl localhost:8000` → connection refused right now
- Agent log shows single startup (process 77257), no recent activity after menus 6-11 batch (last log entry matches ~2026-03-04 translation run)
- Menus 6-11 (updated 2026-03-04 to 2026-03-09) have correct translations — agent was running then
- Menus 1-5 (updated 2026-03-11) lack translations — agent was stopped

**Secondary (silent failure):** `translation-utils.ts` `fetchFromPythonAgent()` catches all errors and returns the original `text` as fallback (lines 43-47). So when the hook runs with agent down, it silently writes the Spanish source text to `ca/en/fr/de` locale records. No error is thrown, no alert fired. This explains why all 5 locales appear populated but contain identical Spanish content.

---

## Fix Path

### Step 1: Start translation agent (immediate, 1 min)

```bash
cd /Users/nemesioj/Documents/Trabajos offline/warynessy-idiomas26/services/translation-agent
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &>> agent.log &
```

Verify: `curl http://localhost:8000/` should return `{"status":"ok",...}`

### Step 2: Re-trigger translations for menus 1-5 (5 min)

Two options:

**Option A — Re-save via Payload admin** (simplest):
Open each of menus 1-5 in Payload admin and click "Save" while agent is running. Hook will fire automatically.

**Option B — Run bulk translation script** (complete):
```bash
cd /Users/nemesioj/Documents/Trabajos offline/warynessy-idiomas26
python3 scripts/translate-payload-content.py
```
This script handles all collections including menus, hitting the agent at `localhost:8000`.

### Step 3: Keep agent running (long term)

Agent should be started as part of the development startup sequence. Consider:
- Adding to `package.json` scripts (e.g., `"dev:agent": "cd services/translation-agent && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000"`)
- Or starting via Docker: `Dockerfile` already exists in `services/translation-agent/`

### Step 4: Improve silent failure logging (optional, low effort)

In `src/payload/utils/translation-utils.ts` line 43, the error is logged but the function returns the original text without any indicator. Consider adding a `[FALLBACK]` prefix or a separate counter to make failures visible in server output.

---

## Timeline

| Date | Event |
|------|-------|
| 2026-01-26 | Menus 1-5 created (no translations existed yet) |
| 2026-02-09 | Menus 6-11 created |
| ~2026-03-04 | Translation agent was running; batch translation ran; menus 6-11 translated correctly |
| 2026-03-09 | Menu 11 updated with agent running; got translations |
| **2026-03-11** | Menus 1-5 updated **with agent stopped**; hook fired but fallback wrote Spanish to all locales |
| 2026-03-11 | Now — agent still stopped, `localhost:8000` connection refused |

---

## Affected Records

```
menus table: IDs 1, 2, 3, 4, 5
Affected locales per menu: ca, en, fr, de (4 locales × 5 menus = 20 records need re-translation)
Fields: nombre, etiqueta, descripcion_menu, fechasDias, descripcion
```

---

## Unresolved Questions

1. Why was the agent stopped? Was there a system restart, crash, or was it manually killed? Knowing this prevents recurrence.
2. Should the agent run in Docker (using the existing `Dockerfile`) or as a bare process? Production setup not confirmed.
3. Is `anthropic/claude-3.5-sonnet` (configured in DB) the intended model, vs `anthropic/claude-3-5-haiku` (code default)? The DB config wins at runtime.
