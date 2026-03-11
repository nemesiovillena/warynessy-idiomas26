# 🚀 Action Plan: Fix Menus Translations

**Date:** 2026-03-11 23:50
**Status:** READY TO EXECUTE
**Root Cause:** Python translation agent not running
**Severity:** HIGH
**Estimated Fix Time:** 10 minutes

---

## 🎯 Problem Summary

**Menus 1-5 translations are missing/incorrect:**
- All locales (ca, en, fr, de) contain identical Spanish text
- Agent was down when these menus were saved on 2026-03-11
- Hook fired correctly but fell back to original Spanish when agent unreachable
- Menus 6-11 have correct translations (agent was running on 2026-03-04)

---

## ✅ Fix Steps (In Order)

### STEP 1: Start the Translation Agent (1 minute)

**Execute these commands:**

```bash
cd /Users/nemesioj/Documents/Trabajos\ offline/warynessy-idiomas26/services/translation-agent

# Activate virtual environment
source venv/bin/activate

# Start the agent in background
uvicorn main:app --host 0.0.0.0 --port 8000 &>> agent.log &

# Verify it's running
sleep 2
curl http://localhost:8000/
```

**Expected output from curl:**
```json
{"status": "ok", "message": "Warynessy Translation Agent is running"}
```

**If curl fails:**
- Check if port 8000 is already in use: `lsof -i :8000`
- Check agent logs: `tail -50 /Users/nemesioj/Documents/Trabajos\ offline/warynessy-idiomas26/services/translation-agent/agent.log`
- Verify Python/uvicorn installed: `which uvicorn`

---

### STEP 2: Re-trigger Translations for Menus 1-5 (5 minutes)

**Option A: Quick Manual Re-save** (Recommended - safest)

1. Open Payload CMS admin at: `http://localhost:3000/admin`
2. Navigate to: Carta → Menús
3. Open Menu 1 ("Menú Típico Villenero")
4. Click **"Save"** button (don't change anything)
5. Wait 3-5 seconds for hook to execute (watch server logs for `[MENUS] [Background]`)
6. **Repeat for Menus 2, 3, 4, 5**
7. Verify in database:
   ```bash
   # After saving all 5, check if translations appeared
   psql -U postgres warynessy -c "SELECT nombre FROM menus WHERE id = 1;"
   # Should show JSONB with multiple locales, not just Spanish
   ```

**Option B: Bulk Translation Script** (Faster - comprehensive)

```bash
cd /Users/nemesioj/Documents/Trabajos\ offline/warynessy-idiomas26

# Run the bulk translate script
python3 scripts/translate-payload-content.py

# This will:
# - Fetch all menus
# - Call agent for each localized field
# - Update all locales with correct translations
# - Log progress to console
```

---

### STEP 3: Verify Translations Were Applied (2 minutes)

**Option A: Check Database**
```bash
psql -U postgres warynessy

# Check if menus 1-5 now have real translations (not just Spanish copies)
SELECT id, nombre FROM menus WHERE id IN (1,2,3,4,5);

# Example output BEFORE fix:
#  id |                             nombre
# ----+-----------------------------------------------
#   1 | {"es": "Menú Típico...", "ca": "Menú Típico...", "en": "Menú Típico...", ...}
#
# Example output AFTER fix:
#  id |                             nombre
# ----+-----------------------------------------------
#   1 | {"es": "Menú Típico...", "ca": "Menú Típic...", "en": "Typical Menu...", "fr": "Menu Typique...", ...}
```

**Option B: Check Admin UI**
1. Open Payload admin: `http://localhost:3000/admin`
2. Go to Menus collection
3. Click on Menu 1
4. Switch language tabs (ES → CA → EN → FR → DE)
5. Verify each shows different content
6. Check that `nombre`, `etiqueta`, `descripcion_menu`, `fechasDias` are all translated

**Option C: Check API**
```bash
# Query for menu 1 in English
curl -X GET "http://localhost:3000/api/collections/menus/1?locale=en" \
  -H "Accept: application/json"

# Should return menu with English translations
# Check: nombre, etiqueta, descripcion_menu, fechasDias fields
```

---

## 🔍 Validation Checklist

After completing all steps, verify:

- [ ] Agent started successfully (curl returns status ok)
- [ ] All 5 menus re-saved or bulk translate script ran
- [ ] Database shows real translations (not Spanish copies) for menus 1-5
- [ ] Admin UI displays different content for each language tab
- [ ] API returns correct locale-specific content
- [ ] No new menus created during fix attempt
- [ ] Agent still running in background

---

## 🛡️ Prevent Recurrence

### Add Agent to Dev Startup

**Option 1: Manual startup procedure**
- Document in README: "Start translation agent before dev: `cd services/translation-agent && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000`"

**Option 2: Add npm script** (Recommended)

Edit `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:app\" \"npm run dev:agent\"",
    "dev:app": "astro dev",
    "dev:agent": "cd services/translation-agent && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000"
  }
}
```

Install concurrently: `npm install --save-dev concurrently`

**Option 3: Use Docker** (Most robust)

```bash
docker build -t warynessy-agent services/translation-agent
docker run -p 8000:8000 warynessy-agent
```

---

## 📊 Expected Results

### Before Fix
```
Menus 1-5:
├── es: "Menú Típico..." ✓
├── ca: "Menú Típico..." ✗ (Spanish copy)
├── en: "Menú Típico..." ✗ (Spanish copy)
├── fr: "Menú Típico..." ✗ (Spanish copy)
└── de: "Menú Típico..." ✗ (Spanish copy)
```

### After Fix
```
Menus 1-5:
├── es: "Menú Típico..." ✓
├── ca: "Menú Típic..." ✓ (Real Catalan)
├── en: "Typical Menu..." ✓ (Real English)
├── fr: "Menu Typique..." ✓ (Real French)
└── de: "Typisches Menü..." ✓ (Real German)
```

---

## 🚨 Troubleshooting

### Agent won't start
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill the process if needed
kill -9 <PID>

# Try again
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Still getting Spanish copies after re-save
1. Verify agent is running: `curl http://localhost:8000/`
2. Check server logs for errors during hook execution
3. Try Option B (bulk script) instead of manual re-save
4. Check OpenRouter API key: `echo $OPENROUTER_API_KEY`

### Translations incomplete (some fields missing)
1. Check hook configuration in `Menus.ts` line 44
2. Verify all localized fields are in the `fieldsToTranslate` list
3. Re-save menu again to retry

---

## 📋 Files Involved

**Agent:**
- `services/translation-agent/main.py` - FastAPI server
- `services/translation-agent/requirements.txt` - Dependencies
- `services/translation-agent/venv/` - Virtual environment

**Configuration:**
- `.env` - Must have `OPENROUTER_API_KEY`
- `payload.config.ts` - Locale setup (5 locales: es, ca, en, fr, de)

**Collection:**
- `src/payload/collections/Menus.ts` - Hook configuration

**Utilities:**
- `src/payload/utils/translation-utils.ts` - Translation logic
- `scripts/translate-payload-content.py` - Bulk translate script

**Database:**
- Table: `menus`
- Affected columns: `nombre`, `etiqueta`, `descripcion_menu`, `fechasDias`, `descripcion`

---

## ✨ Success Criteria

✅ All 5 menus have real translations in all 4 target locales
✅ No Spanish text appears in non-Spanish locale fields
✅ Admin UI shows different content for each language
✅ Database JSONB structure is correct
✅ Agent continues running without issues
✅ Future menu creations auto-translate without manual intervention

---

## 📞 Quick Reference

| Item | Details |
|------|---------|
| Agent location | `services/translation-agent/main.py` |
| Agent port | `8000` |
| Health check | `curl http://localhost:8000/` |
| API key env | `OPENROUTER_API_KEY` |
| Config model | `anthropic/claude-3.5-sonnet` (in DB) |
| Collections affected | `menus` (5 records) |
| Locales affected | ca, en, fr, de (4 locales × 5 menus = 20 records) |
| Fix time estimate | 10 minutes |
| Risk level | Low (non-destructive, can retry) |

---

## 🏁 Summary

1. **Start agent** (1 min): `uvicorn main:app --host 0.0.0.0 --port 8000`
2. **Re-trigger translations** (5 min): Option A (admin UI) or Option B (bulk script)
3. **Verify** (2 min): Check database, admin UI, or API
4. **Prevent recurrence**: Add to dev startup procedure

**Total Time:** 8-10 minutes
**No code changes needed** (fix is operational, not code)
**Safe to execute immediately**

