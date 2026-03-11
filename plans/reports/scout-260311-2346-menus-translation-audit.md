# Scout Report: Menus Translation Audit

**Date:** 2026-03-11 23:46
**Status:** Complete - Ready for Debugging & Implementation
**Scope:** Menus collection localization configuration, translation hooks, database structure

---

## 📊 Executive Summary

The Menus collection has proper localization setup with all required fields marked as `localized: true`, and an afterChange hook configured for automatic translations to ca, en, fr, de. However, **translations are not appearing in user-facing content**.

### Quick Stats
| Item | Status |
|------|--------|
| Localization fields configured | ✅ 5/5 |
| Translation hook registered | ✅ Present |
| Target locales defined | ✅ ca, en, fr, de |
| Database schema | ✅ JSONB localized |
| Configuration global | ⚠️ Needs verification |
| Python translation agent | ⚠️ Needs verification |

---

## 🔍 Key Findings

### Menus Collection Configuration
**File:** `src/payload/collections/Menus.ts`

#### Localized Fields (5 total)
```
✅ nombre              (text) - Menu name
✅ etiqueta            (text) - Badge label
✅ descripcion_menu    (textarea) - Menu info
✅ fechasDias          (text) - Availability label
✅ descripcion         (richText) - Full composition
```

#### Non-Localized Fields (correct)
```
slug, precio, fecha{Inicio|Fin}, imagen, pdf, activo, destacado, orden, diasSemana, horario
```

### Translation Hook Configuration
**Type:** afterChange hook
**Triggers:** create, update operations on Spanish locale
**Target Locales:** `['ca', 'en', 'fr', 'de']`
**Fields to Translate:** All 5 localized fields (matches configuration ✓)

#### Hook Flow
```
User edits menu in Spanish (locale=es)
           ↓
afterChange hook fires
           ↓
Locale guard check: locale === 'es'? YES
           ↓
Race condition check: Is doc already translating? NO
           ↓
Fetch ConfiguracionTraduccion global
           ↓
For each target locale (ca, en, fr, de):
  → Extract Spanish values
  → Call Python agent for translation
  → Update Payload with disableHooks=true
           ↓
Remove doc from translatingIds, done
```

---

## ⚠️ Potential Root Causes

### Issue #1: Python Translation Agent Down/Unreachable
**Probability:** HIGH
**Impact:** Translations fail silently in background

**Evidence:**
- Hook calls agent at: `http://localhost:8000/translate` (default)
- If agent down → HTTP request fails
- Error only logged to console (user doesn't see)
- Menu creation completes successfully (appears Spanish-only)

**Test:**
```bash
curl http://localhost:8000/translate
# Should respond, not refuse connection
```

---

### Issue #2: OpenRouter API Key Missing/Invalid
**Probability:** HIGH
**Impact:** LLM translation fails, no translations generated

**Evidence:**
- Hook calls Python agent with model: `anthropic/claude-3-5-haiku`
- Agent uses OpenRouter API internally
- If API key missing → agent returns error
- Error caught in try/catch, only logged

**Test:**
```bash
# Check .env file for OPENROUTER_API_KEY
grep OPENROUTER_API_KEY .env
```

---

### Issue #3: ConfiguracionTraduccion Global Not Initialized
**Probability:** MEDIUM
**Impact:** Uses default endpoint, may be wrong if customized

**Evidence:**
- Hook fetches global on every translation:
  ```typescript
  const configTraduccion = await payload.findGlobal({
    slug: 'configuracion-traduccion'
  });
  ```
- If global doesn't exist → may throw error or use fallback
- Fallback endpoint: `http://localhost:8000/translate`

**Test:**
```bash
# Check Payload admin for ConfiguracionTraduccion global
# Or query: SELECT * FROM globals WHERE slug='configuracion-traduccion';
```

---

### Issue #4: Hook Locale Guard Always Returns Early
**Probability:** LOW
**Impact:** Hook never executes for any menu

**Evidence:**
- Locale guard at line 25:
  ```typescript
  if (locale && locale !== 'es') {
    return;
  }
  ```
- Only processes Spanish locale
- If request locale not set or always non-Spanish → never runs

**Test:**
```typescript
// Add logging to verify locale
console.log(`[MENUS] Hook received locale: ${locale}`);
```

---

### Issue #5: Update Request Fails During Translation Storage
**Probability:** LOW
**Impact:** Translations generated but not saved to database

**Evidence:**
- After translation, hook calls:
  ```typescript
  await req.payload.update({
    collection: 'menus',
    id: doc.id,
    locale: locale as any,  // ← suspicious 'any' cast
    data: translatedData,
    req: { disableHooks: true }
  });
  ```
- If update fails → error caught, only logged
- Translations lost

**Test:**
```bash
# Check database directly
SELECT nombre FROM menus WHERE id='{test-menu-id}' LIMIT 1;
# Should show JSONB with ca, en, fr, de keys
```

---

## 📁 Related Files Map

### Core Collection
```
src/payload/collections/Menus.ts
├── Lines 85-253: Fields configuration (5 localized)
├── Lines 18-83: afterChange hook setup
├── Lines 43: Target locales ['ca', 'en', 'fr', 'de']
└── Lines 44: Fields to translate list
```

### Translation Infrastructure
```
src/payload/utils/translation-utils.ts
├── translateDocument()     - Main orchestrator
├── translateLexical()      - RichText translation
├── callTranslationAgent()  - HTTP to Python agent
└── translatingIds Set      - Race condition protection

src/payload/globals/ConfiguracionTraduccion.ts
├── modeloIA              - AI model selection
├── endpointAgente        - Python agent URL
└── proveedorIA           - Provider (always 'agente-python')

payload.config.ts
└── Lines 57-71: Locale configuration (5 locales, es default)
```

### API Routes (for bulk translation)
```
src/app/api/translate-menus/route.ts (if exists)
├── GET endpoint for bulk translating all menus
├── Requires ?secret=PAYLOAD_SECRET
└── Should populate existing menu translations

src/app/api/translate-all/route.ts (if exists)
├── Bulk endpoint for all collections
├── Requires COLLECTION_FIELDS mapping
└── Menus & MenusGrupo should be listed
```

---

## 🧪 Recommended Test Plan

### Test 1: Hook Execution (5 min)
1. Add console.log to hook start
2. Create new test menu in Spanish via admin
3. Watch server logs for `[MENUS]` messages
4. Result: Confirms hook fires or identifies early return

### Test 2: Agent Reachability (2 min)
```bash
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Menú del Día","target_lang":"en","model":"anthropic/claude-3-5-haiku"}'
```
- Result: Confirms agent accessible or identifies network issue

### Test 3: Database State (2 min)
```sql
SELECT id, nombre, etiqueta FROM menus LIMIT 1;
```
- Result: Shows if translations stored as JSONB with locale keys

### Test 4: Compare with Working Collection (5 min)
1. Check if Platos collection translations work
2. If yes: Problem is Menus-specific
3. If no: Problem is systemic (agent, config, etc.)

---

## 🎯 Next Phase Actions

### Phase 1: Diagnosis (Debugger Agent)
1. ✅ Add enhanced logging to Menus.ts hook
2. ✅ Verify Python agent reachability
3. ✅ Check ConfiguracionTraduccion initialization
4. ✅ Query database for actual translation state
5. ✅ Compare with another collection (Platos)

### Phase 2: Fix Implementation
Based on Phase 1 findings:
- If hook doesn't execute → check locale passing
- If agent unreachable → start Python agent or fix URL
- If API key missing → add to .env
- If update fails → fix permission/data format
- If systemic → update all collections simultaneously

### Phase 3: Verification
1. Create test menu in Spanish
2. Verify translations appear in all locales
3. Test admin UI shows correct translations
4. Bulk translate any existing Spanish-only menus
5. Verify no regressions in other collections

---

## 📋 Verification Checklist

Before declaring issue resolved:
- [ ] New menus auto-translate on creation
- [ ] Existing menus can be bulk translated via API
- [ ] All 5 localized fields translated correctly
- [ ] Admin UI shows translations for each locale
- [ ] Database JSONB structure correct
- [ ] RichText fields preserve formatting
- [ ] No infinite translation loops
- [ ] Translations appear on frontend

---

## 🚨 Critical Observations

1. **Background Execution:** Hook doesn't wait for translations to complete
   - Menu save returns before translations finish
   - User won't see immediate feedback
   - Errors only logged to server console

2. **Silent Failures:** Translations fail without user notification
   - Hook catches all errors
   - Only logs to console
   - User thinks menu is fully created

3. **External Dependency:** Relies on Python agent + OpenRouter API
   - Multiple failure points
   - Network timeout risk
   - API key dependency

4. **No Retry Logic:** If translation fails once, no automatic retry
   - Must manually re-trigger by editing menu again

---

## 📊 Collection Comparison

| Aspect | Menus | Platos | Banners |
|--------|-------|--------|---------|
| Localized fields | 5 | 3 | 3 |
| afterChange hook | ✅ | ✅ | ✅ |
| Target locales | ca,en,fr,de | ca,en,fr,de | ca,en,fr,de |
| Hook field list | Matches | Matches | ⚠️ Mismatch |
| Translations working? | ❓ Testing | ✓ Likely | ⚠️ Verify |

---

## 📝 Unresolved Questions

1. **When was last successful translation?** (Check timestamps in DB or logs)
2. **Are ANY menus translated, or completely empty?** (DB query needed)
3. **Do other collections (Platos, Banners) have same issue?** (Compare behavior)
4. **What errors appear in server logs?** (Enable debug logging)
5. **Is Python agent container running?** (Check Docker or process list)
6. **Have recent code changes broken something?** (Check git history for hooks)

---

## 🔗 Related Documentation

- **Main Plan:** `plans/260311-2346-menus-translation-audit-fix/plan.md`
- **Research Report:** `plans/reports/research-260311-2346-menus-translation-structure.md`
- **i18n Investigation:** `plans/reports/Explore-260311-2345-i18n-investigation.md`
- **Previous Fix:** `plans/reports/debugger-260311-1243-translations-missing-dishes.md`

---

## Summary

**Status:** Ready for debugging phase
**Confidence:** 85% one of 5 identified issues is root cause
**Effort to Fix:** 1-2 hours (depending on root cause)
**Risk:** Low (translations are background process, safe to test)

Next: Spawn debugger agent to investigate Issues #1-2 (most likely) and validate database state.

