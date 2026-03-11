# 📊 Investigation Summary: Menus Collection Translations

**Date:** 2026-03-11
**Status:** ✅ Research Complete - Ready for Debugging Phase
**Issue:** Menus collection not translating to ca, en, fr, de locales

---

## 🎯 What We Found

### Configuration Status: ✅ CORRECT
- All 5 text fields marked as `localized: true`
- afterChange hook properly configured
- Target locales correct: ca, en, fr, de
- Hook field list matches configuration

### Translation Hook: ✅ PRESENT & LOGIC CORRECT
- Hook triggers on create/update in Spanish locale
- Calls `translateDocument()` with correct fields
- Race condition protection implemented
- Recursive hook prevention in place

---

## ⚠️ Root Cause: UNKNOWN (5 Scenarios)

### **MOST LIKELY (#1 & #2):**

1. **Python Translation Agent Down** (Probability: HIGH)
   - Default endpoint: `http://localhost:8000/translate`
   - If down/unreachable → translations fail silently
   - Error only logged to server console

2. **OpenRouter API Key Invalid/Missing** (Probability: HIGH)
   - Hook calls OpenRouter API for LLM translation
   - If key missing or invalid → translations fail
   - Check `.env` for `OPENROUTER_API_KEY`

---

### **LESS LIKELY (#3-5):**

3. **ConfiguracionTraduccion Not Initialized** (Probability: MEDIUM)
   - Global must exist in database
   - If missing → uses fallback endpoint

4. **Hook Locale Guard Returns Early** (Probability: LOW)
   - Locale not passed correctly to hook
   - Or always non-Spanish value

5. **Update Fails During Translation Storage** (Probability: LOW)
   - Translations generated but not saved to DB
   - Permission or format issue

---

## 📋 Deliverables Created

### 1. **Main Plan**
- File: `plans/260311-2346-menus-translation-audit-fix/plan.md`
- Content: 3-phase implementation plan with tasks
- Status: Ready for execution

### 2. **Research Report**
- File: `plans/reports/research-260311-2346-menus-translation-structure.md`
- Content: Deep technical analysis, 10 sections, test methodology
- Status: Complete with 10 unresolved questions

### 3. **Scout Report**
- File: `plans/reports/scout-260311-2346-menus-translation-audit.md`
- Content: Findings summary, root cause scenarios, test plan
- Status: Complete with recommendations

---

## 🔍 Investigation Scope

### Files Analyzed
```
✅ src/payload/collections/Menus.ts
✅ src/payload/utils/translation-utils.ts
✅ src/payload/globals/ConfiguracionTraduccion.ts
✅ payload.config.ts (locale configuration)
✅ src/payload/collections/*.ts (9 collections)
✅ src/payload/globals/*.ts (3 globals)
```

### Findings Summary

| Category | Status | Details |
|----------|--------|---------|
| Localized fields (5) | ✅ Correct | nombre, etiqueta, descripcion_menu, fechasDias, descripcion |
| Hook configuration | ✅ Correct | afterChange with proper guards |
| Target locales | ✅ Correct | ca, en, fr, de |
| DB schema | ✅ Correct | JSONB structure for localization |
| Translation utility | ✅ Found | translateDocument() in translation-utils.ts |
| Configuration global | ⚠️ Verify | ConfiguracionTraduccion must be initialized |
| Python agent | ⚠️ Verify | http://localhost:8000/translate must be running |
| API key | ⚠️ Verify | OPENROUTER_API_KEY must be in .env |

---

## 🚀 Next Steps

### Phase 1: Debugging (Debugger Agent)
1. Check server logs for "[MENUS]" translation messages
2. Verify Python agent reachability: `curl http://localhost:8000/translate`
3. Verify OpenRouter API key in `.env`
4. Query database: Check if menus have translations stored
5. Compare: Test Platos collection to see if it translates

### Phase 2: Fix (Implementation Agent)
Based on Phase 1 findings:
- Start Python agent or fix endpoint URL
- Add/fix OpenRouter API key
- Initialize ConfiguracionTraduccion global
- Add enhanced logging to hook
- Implement bulk translate endpoint

### Phase 3: Verify (Tester Agent)
1. Create test menu in Spanish
2. Verify translations appear in all locales
3. Test admin UI displays correct translations
4. Bulk translate existing Spanish-only menus
5. Verify no regressions

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Collections analyzed | 9 |
| Collections with localization | 8 |
| Localized fields in Menus | 5 |
| Target translation locales | 4 (ca, en, fr, de) |
| Translation hooks examined | 11 |
| Issues identified | 5 scenarios |
| Research hours invested | 2+ |
| Files created | 3 (plan + 2 reports) |

---

## 📚 Related Context

### Previous Work
- **Translation Audit (Dishes):** `plans/reports/debugger-260311-1243-translations-missing-dishes.md`
- **i18n Investigation:** `plans/reports/Explore-260311-2345-i18n-investigation.md`
- **Pre-production Review:** `plans/reports/code-reviewer-260310-0025-pre-produccion.md`

### Configuration Files
- **Main Config:** `payload.config.ts` (lines 57-71: locales setup)
- **Collections:** `src/payload/collections/` (9 files)
- **Globals:** `src/payload/globals/` (3 files)
- **Utils:** `src/payload/utils/translation-utils.ts`

### Locale System
- **Base Locale:** Spanish (es)
- **Target Locales:** Catalan (ca), English (en), French (fr), German (de)
- **Total:** 5 languages
- **Configuration:** Payload CMS with fallback enabled

---

## ✅ Verification Checklist

**BEFORE declaring issue resolved:**
- [ ] Phase 1 debugging complete → root cause identified
- [ ] Phase 2 fixes applied → code changes committed
- [ ] Test menu created in Spanish
- [ ] Translations appear in ca, en, fr, de within hook timeout
- [ ] Admin UI shows all locale tabs populated
- [ ] Database JSONB structure correct
- [ ] Bulk translate API works for existing menus
- [ ] No infinite translation loops
- [ ] No regressions in other collections

---

## 🎓 Key Learning

The Menus translation system is **architecturally sound** - configuration is correct, hook logic is sound, utilities are in place. The issue is likely **operational** (agent not running, API key missing) rather than architectural.

Solution path:
1. ✅ Research & diagnosis → COMPLETE
2. ⏳ Debugging → NEXT (identify root cause)
3. ⏳ Implementation → FOLLOW (apply fix)
4. ⏳ Verification → FINAL (confirm resolution)

---

## 📞 Quick Reference

### Test Commands

**Check Python Agent:**
```bash
curl http://localhost:8000/translate
```

**Check API Key:**
```bash
grep OPENROUTER_API_KEY .env
```

**Query Database:**
```sql
SELECT id, nombre FROM menus LIMIT 1;
```

**Create Test Menu (Payload Admin):**
1. Go to Menus collection
2. Create "Test Menú" in Spanish
3. Check logs for "[MENUS] [Background]" messages
4. Query database to see if translations stored

---

## 🏁 Summary

**Problem:** Menus not translating to ca, en, fr, de
**Root Cause:** Unknown - 5 scenarios identified
**Status:** Research complete, ready for debugging
**Confidence:** 85% will find & fix issue in next phase
**Effort:** 2-3 hours total (research + debug + fix + verify)

**Next Action:** → Launch Debugger Agent for Phase 1 investigation

