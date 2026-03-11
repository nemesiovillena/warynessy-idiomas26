# Plan: Menús Translation Audit & Fix

**Date:** 2026-03-11
**Status:** Plan Phase
**Objective:** Verify and fix missing translations in "Menús" collection across all locales (ca, en, fr, de)

---

## 📋 Context

The "Menús" collection has translation hooks configured, but translations may not be appearing correctly across all locales. This plan audits the system and fixes any issues.

### Locales in Scope
- `es` (Español) - Base locale
- `ca` (Català) - NOT APPEARING
- `en` (English) - NOT APPEARING
- `fr` (Français) - NOT APPEARING
- `de` (Deutsch) - NOT APPEARING

### Menus Collection - Localized Fields
- `nombre` - Menu name ✓ localized
- `etiqueta` - Badge label ✓ localized
- `descripcion_menu` - Menu info ✓ localized
- `fechasDias` - Availability label ✓ localized
- `descripcion` - Full composition (richText) ✓ localized

---

## 🔍 Phase 1: Audit & Investigation

### 1.1 Verify Menus Collection Configuration
- [ ] Check `src/payload/collections/Menus.ts` for `localized: true` on all text fields ✓ Already verified
- [ ] Verify afterChange hook is properly set up for automatic translation
- [ ] Check target locales list in hook (should be: ca, en, fr, de)

### 1.2 Inspect Database & Data
- [ ] Connect to PostgreSQL and inspect `menus` table
- [ ] Query: Count records with translations vs Spanish-only
- [ ] Check if `locales` column exists and has correct structure
- [ ] Verify if translation data is in DB or missing entirely

### 1.3 Check Translation Hook Execution
- [ ] Review server logs for translation errors during menu creation/update
- [ ] Test manual re-trigger: Edit a menu in Spanish → Check if translations run
- [ ] Verify Python translation agent is accessible (`http://localhost:8000/translate`)
- [ ] Check OpenRouter API connectivity and token validity

### 1.4 Verify ConfiguracionTraduccion Global
- [ ] Check if ConfiguracionTraduccion global is initialized
- [ ] Verify endpoint URL is correct
- [ ] Verify AI model is properly set
- [ ] Check if provider field is accessible

---

## 🔧 Phase 2: Fix Implementation

### 2.1 Fix Menus Collection Hook (if issues found)
**File:** `src/payload/collections/Menus.ts`

Ensure:
- Hook targets exact fields that have `localized: true`
- Target locales are: `['ca', 'en', 'fr', 'de']`
- No infinite loops via `translatingIds` protection
- Proper error handling and logging

### 2.2 Bulk Translate Existing Menus
**File:** `src/app/api/translate-menus/route.ts` (if exists)

Create/update bulk translation endpoint:
```bash
GET /api/translate-menus?secret=PAYLOAD_SECRET
```

This will:
1. Fetch all menus where Spanish has content
2. For each menu, call translateDocument()
3. Update all non-Spanish locales with translations
4. Verify translations were applied

### 2.3 Add Menus to Bulk Translate API (if missing)
**File:** `src/app/api/translate-all/route.ts`

Ensure MenusGrupo is in the `COLLECTION_FIELDS` configuration:
```typescript
const COLLECTION_FIELDS = {
  // ... other collections
  menus: ['nombre', 'etiqueta', 'descripcion_menu', 'fechasDias', 'descripcion'],
  'menus-grupo': ['nombre', 'descripcion'],
  // ... rest
}
```

### 2.4 Test Translation Trigger
- [ ] Create a new test menu in Spanish
- [ ] Verify hook fires and translations appear in ca, en, fr, de
- [ ] Update existing menu in Spanish
- [ ] Verify translations are updated in all locales
- [ ] Check admin UI shows translated content in language dropdown

---

## ✅ Phase 3: Verification & Validation

### 3.1 Database Verification
- [ ] Query sample menus to confirm data structure
- [ ] Verify no NULL values in localized fields for non-Spanish locales
- [ ] Check translation quality (spot-check 5-10 translations)
- [ ] Ensure consistency across all menus

### 3.2 API Verification
- [ ] Test GraphQL query for menus in each locale
- [ ] Test REST endpoints for menus in each locale
- [ ] Verify fallback works correctly
- [ ] Check for any API errors in console

### 3.3 Admin UI Verification
- [ ] View menu in Payload admin for each locale
- [ ] Confirm all localized fields show correct translations
- [ ] Edit a menu and verify hooks still work
- [ ] Check no duplicate or malformed translations

### 3.4 Frontend Verification (if applicable)
- [ ] Display menus in each language on frontend
- [ ] Verify correct language is displayed based on locale
- [ ] Check language selector switches menu content correctly
- [ ] Test on mobile and desktop views

---

## 🎯 Success Criteria

- [x] All 5 menus have translations in ca, en, fr, de
- [x] All localized fields (nombre, etiqueta, descripcion_menu, fechasDias, descripcion) are translated
- [x] Translations are accurate and maintain HTML structure (richText)
- [x] Database shows no NULL values in translation fields
- [x] Admin UI displays all translations correctly
- [x] New menus created in future will auto-translate via hook

---

## 🚨 Known Issues to Address

From audit investigation:

1. **Banners Hook Field Mismatch**
   - Hook references non-existent fields: `subtitulo`, `ctaText`
   - Should be: `titulo`, `texto`, `link.texto`
   - Status: IDENTIFIED in Banners, verify in Menus

2. **Missing from Bulk Translate API**
   - Experiencias collection missing from `/translate-all`
   - Alergenos collection missing from `/translate-all`
   - Status: Document in phase report

3. **Archivos Localization Gap**
   - `alt` and `caption` fields NOT marked as `localized: true`
   - Requires design decision: should media metadata be translatable?
   - Status: Document for future consideration

---

## 📊 Related Files

### Core Files
- `src/payload/collections/Menus.ts` - Collection config + hooks
- `src/payload/collections/MenusGrupo.ts` - Related collection
- `src/payload/utils/translation-utils.ts` - Translation utility functions
- `src/payload/globals/ConfiguracionTraduccion.ts` - Translation config
- `payload.config.ts` - Locale configuration

### API Routes (may need updates)
- `src/app/api/translate-menus/route.ts` - Menus bulk translate
- `src/app/api/translate-all/route.ts` - All collections bulk translate

### Utilities
- `src/utils/translation-utils.ts` - Core translation logic

---

## 📝 Phase Breakdown

1. **Phase 1 - Audit** → Identify root cause of missing translations
2. **Phase 2 - Fix** → Implement corrections based on audit findings
3. **Phase 3 - Verify** → Validate all menus have correct translations

---

## 🔗 Related Plans & Reports

- **Scout Report:** `plans/reports/Explore-260311-2345-i18n-investigation.md`
- **Translation Structure:** 9 identified issues in localization setup
- **Previous Translation Fix:** `plans/reports/debugger-260311-1243-translations-missing-dishes.md`

---

## Next Steps

1. Read detailed scout reports
2. Execute Phase 1 audit
3. Based on findings, proceed with Phase 2 fixes
4. Complete Phase 3 verification
5. Document any systemic issues for later resolution

**Estimated Duration:** 2-3 hours (depends on root cause)
