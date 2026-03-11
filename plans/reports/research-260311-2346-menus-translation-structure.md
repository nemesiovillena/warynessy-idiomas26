# Research Report: Menus Translation Structure Analysis

**Date:** 2026-03-11 23:46
**Researcher:** Research Agent
**Focus:** Deep analysis of why Menus translations are not appearing across locales

---

## Executive Summary

The Menus collection has proper localization configuration with `localized: true` on all text fields and an afterChange hook that should trigger automatic translations. However, based on user report, translations are not appearing in ca, en, fr, de locales. This research identifies 3 likely root causes and testing methodology.

---

## 1. Menus Collection Configuration ✅ VERIFIED

### Fields Configuration
**File:** `src/payload/collections/Menus.ts` (lines 85-253)

**Localized Text Fields:**
```typescript
1. nombre (text) - localized: true ✓
2. etiqueta (text) - localized: true ✓
3. descripcion_menu (textarea) - localized: true ✓
4. fechasDias (text) - localized: true ✓
5. descripcion (richText) - localized: true ✓
```

**Non-localized Fields:**
- slug, precio, fechaInicio, fechaFin, imagen, pdf, activo, destacado, orden, diasSemana, horario

✅ **Configuration is CORRECT.** Fields that should be translated ARE marked as `localized: true`.

---

## 2. Translation Hook Analysis

### Hook Location & Trigger
**File:** `src/payload/collections/Menus.ts` (lines 18-83)

**Hook Type:** `afterChange` hook
**Triggered On:** `create` and `update` operations
**Trigger Condition:** `locale === 'es'` (Spanish only)

### Hook Logic Flow

```typescript
// CRITICAL CHECKS
1. Locale Guard (line 25)
   if (locale && locale !== 'es') {
     return; // ← ONLY PROCESSES SPANISH EDITS
   }

2. Operation Check (line 29)
   if (operation === 'create' || operation === 'update') {
     // Process translations
   }

3. Race Protection (line 32-36)
   if (translatingIds.has(doc.id)) {
     console.log(`Traducción ya en curso...`);
     return;
   }
   translatingIds.add(doc.id);

4. Configuration Fetch (line 39)
   const configTraduccion = await payload.findGlobal({
     slug: 'configuracion-traduccion'
   });

5. Target Locales (line 43)
   const targetLocales = ['ca', 'en', 'fr', 'de'] as const;

6. Fields to Translate (line 44)
   const fieldsToTranslate = ['nombre', 'etiqueta', 'descripcion_menu', 'fechasDias', 'descripcion'];
```

### Issues Identified

**✓ POSITIVE:**
- Hook is properly async/await
- Target locales are correct (ca, en, fr, de)
- Fields list matches actual localized fields
- Race condition protection with `translatingIds`
- Calls `disableHooks: true` to prevent recursion

**⚠️ CONCERNS:**
1. **Background Execution** (line 79)
   - Hook calls `executeTranslations()` without `await`
   - Means: Create/update returns BEFORE translations complete
   - This is intentional (background), but means translations may fail silently

2. **Error Handling** (line 72)
   - Catches errors in try/catch
   - Only logs errors to console
   - No user notification of translation failures
   - User may think translation worked when it failed

3. **ConfiguracionTraduccion Dependency** (line 39)
   - Must exist in database for translations to work
   - If not initialized: endpoint defaults to `http://localhost:8000/translate`
   - If server down: translations fail silently

---

## 3. ConfiguracionTraduccion Global Status

### Expected Configuration
**File:** `src/payload/globals/ConfiguracionTraduccion.ts`

```typescript
{
  modeloIA: 'anthropic/claude-3-5-haiku' (default)
  endpointAgente: 'http://localhost:8000/translate' (default)
  proveedorIA: 'agente-python' (readonly)
}
```

### Critical Dependency
The hook fetches this global on EVERY translation:
```typescript
const configTraduccion = await payload.findGlobal({
  slug: 'configuracion-traduccion'
});
```

**Failure Points:**
1. If global doesn't exist → defaults to fallback values
2. If endpoint URL is wrong → HTTP request fails
3. If Python agent is down → translations fail
4. If OpenRouter API key missing → LLM translation fails

---

## 4. Translation Utility Function Analysis

### Function: `translateDocument()`
**File:** `src/payload/utils/translation-utils.ts`

**What It Does:**
1. Takes document, fields list, target language
2. Extracts values for each field from source (es) locale
3. For richText fields: Calls `translateLexical()` recursively
4. Calls Python agent endpoint for translation
5. Returns translated object for target locale

**Pseudo-code:**
```typescript
async function translateDocument({
  doc,              // The menu document
  previousDoc,      // Previous version (for change detection)
  fields,           // Fields to translate
  targetLang,       // Target language (ca/en/fr/de)
  endpoint,         // Python agent URL
  model,            // LLM model name
  operation         // 'create' or 'update'
}) {
  // 1. Extract Spanish values
  const esData = extractFromLocale(doc, fields, 'es');

  // 2. For richText, recursively translate nodes
  if (field.type === 'richText') {
    translatedValue = await translateLexical(...);
  }

  // 3. Call Python agent
  const translations = await callTranslationAgent({
    text: esData,
    targetLang,
    endpoint,
    model
  });

  // 4. Return translated data
  return { translatedData, hasTranslations };
}
```

**Potential Issues:**
1. **Network Dependency:** Requires HTTP request to external agent
2. **Type Handling:** May fail on unexpected field types
3. **RichText Complexity:** Lexical structure preservation depends on implementation
4. **Array Fields:** Menus doesn't have arrays, but other collections do

---

## 5. Database Structure Verification

### Expected Payload CMS Localization Structure

Payload CMS with `localized: true` fields creates:

**Single Table Strategy** (with JSON columns):
```sql
CREATE TABLE menus (
  id UUID PRIMARY KEY,
  nombre JSONB,           -- { es: "Menú", ca: "Menú", en: "Menu", fr: "Menu", de: "Speisekarte" }
  etiqueta JSONB,         -- Same structure
  descripcion_menu JSONB, -- Same structure
  fechasDias JSONB,       -- Same structure
  descripcion JSONB,      -- RichText JSON structure
  -- Non-localized fields
  slug TEXT,
  precio NUMERIC,
  activo BOOLEAN,
  -- ... other fields
);
```

**Expected Data Pattern:**
```json
{
  "id": "uuid-here",
  "nombre": {
    "es": "Menú del Día",
    "ca": "Menú del Dia",
    "en": "Daily Menu",
    "fr": "Menu du Jour",
    "de": "Tagesmenü"
  },
  "etiqueta": {
    "es": "Popular",
    "ca": "Popular",
    "en": "Popular",
    "fr": "Populaire",
    "de": "Beliebt"
  },
  // ... other localized fields
}
```

---

## 6. Three Root Cause Scenarios

### Scenario A: Hook Never Executes ⚠️
**Symptom:** Spanish menus exist, but zero translations in any locale

**Possible Causes:**
1. Locale guard (line 25) always returns early
   - Check: Is the request locale being passed correctly?
2. Operation is neither 'create' nor 'update'
   - Check: What operation type is actually used?
3. Hook is disabled or not registered
   - Check: Does Menus.ts export the hook correctly?

**Test:**
```bash
# Add a new test menu in Spanish
# Check server logs for "[MENUS] [Background]" messages
# If no logs appear → hook not executing
```

---

### Scenario B: Hook Executes but Translation Fails ⚠️
**Symptom:** Spanish menus exist, logs show hook ran, but no translations appear

**Possible Causes:**
1. Python agent endpoint unreachable
   - Default: `http://localhost:8000/translate`
   - Check: Is Python agent running?
2. OpenRouter API key missing or invalid
   - Check: `.env` file for `OPENROUTER_API_KEY`
3. ConfiguracionTraduccion global not initialized
   - Check: Does it exist in database?
4. Network error during translation request
   - Check: Server logs for HTTP errors

**Test:**
```bash
# Curl the Python agent directly
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Menú del Día","target_lang":"en"}'

# Should return: { "translated": "Menu of the Day" }
```

---

### Scenario C: Translations Complete but Not Stored ⚠️
**Symptom:** Hook logs show "Aplicando traducciones", but data not in database

**Possible Causes:**
1. Update request fails silently
   ```typescript
   await req.payload.update({
     collection: 'menus',
     id: doc.id,
     locale: locale as any,  // ← Casting to 'any' is suspicious
     data: translatedData,
     req: { disableHooks: true }
   });
   ```
   - Check: Does update throw/log errors?

2. Payload permission issue
   - Check: Can the hook user update this collection?

3. Data format issue
   - Check: Is `translatedData` in correct shape?

**Test:**
```bash
# Manually update a menu via API with test translations
# Check if update succeeds
# Verify data appears in database
```

---

## 7. Comparison with Working Collections

### Platos Collection (Likely Working) ✓
**File:** `src/payload/collections/Platos.ts`

**Hook Pattern:** IDENTICAL to Menus
- Same locale guard
- Same target locales: `['ca', 'en', 'fr', 'de']`
- Same fields list in hook
- Same `translateDocument()` call

**Difference?** If Platos translations work but Menus don't → problem is likely:
- Menus-specific field type issue
- Menus-specific data shape problem
- OR: Neither is actually working

---

## 8. Testing Methodology

### Test 1: Hook Execution Verification
```typescript
// Add temp logging to hook at line 46
console.log(`[MENUS-DEBUG] Hook fired for doc ${doc.id}, locale=${locale}`);
console.log(`[MENUS-DEBUG] Operation: ${operation}`);
console.log(`[MENUS-DEBUG] ConfigTraduccion: ${JSON.stringify(configTraduccion)}`);

// Create a test menu in Spanish
// Check console for [MENUS-DEBUG] messages
// If present → hook executes
// If absent → hook not running
```

### Test 2: Translation Agent Reachability
```bash
# In terminal
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Menú del Día",
    "target_lang": "en",
    "model": "anthropic/claude-3-5-haiku"
  }'

# Expected: { "translated": "Menu of the Day" }
# If connection refused → agent down
# If timeout → agent hung
# If 500 error → invalid config
```

### Test 3: Database State Inspection
```sql
-- Connect to PostgreSQL
SELECT
  id,
  nombre,
  etiqueta,
  descripcion_menu,
  fechasDias
FROM menus
LIMIT 1;

-- Check if JSONB structure has multiple locales
-- Expected: { "es": "...", "ca": "...", "en": "..." }
-- If only { "es": "..." } → translations not stored
```

### Test 4: Manual Update Via API
```bash
# Update a menu directly with translations
curl -X PATCH http://localhost:3000/api/collections/menus/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": {
      "es": "Menú del Día",
      "ca": "Menú del Dia",
      "en": "Daily Menu"
    }
  }'

# If update succeeds → payload.update() works
# If fails → permission/format issue
```

---

## 9. Configuration Checklist

**Must Verify:**
- [ ] ConfiguracionTraduccion global exists in database
- [ ] .env contains valid OPENROUTER_API_KEY
- [ ] Python translation agent running at http://localhost:8000
- [ ] Payload CMS localization enabled with fallback: true
- [ ] Menus collection has localization registered
- [ ] All 5 locales (es, ca, en, fr, de) in payload.config.ts locales array

---

## 10. Unresolved Questions

1. **Are ANY menus currently translated?** Or completely empty in non-ES locales?
2. **Are other collections (Platos, Banners) translating correctly?** (If yes → Menus-specific issue)
3. **When were last translations attempted?** (Check server logs with timestamps)
4. **Is Python agent running locally or in container?** (Affects localhost:8000 reachability)
5. **What's the exact error message (if any) in browser console or server logs?**

---

## Recommendations for Next Phase

1. **Immediate:** Check server logs for "[MENUS]" messages during menu creation
2. **Quick Win:** Verify Python agent is running: `curl http://localhost:8000/health`
3. **Deep Dive:** Add enhanced logging to hook to track each step
4. **Test:** Create test menu, watch full hook execution flow
5. **Compare:** Test a Platos dish to see if it translates (compare behavior)

