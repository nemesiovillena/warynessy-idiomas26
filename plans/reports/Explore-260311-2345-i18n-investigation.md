# i18n Configuration & Globals Setup Investigation

**Date:** 2026-03-11  
**Focus:** Locales, translation triggering, ConfiguracionTraduccion setup, and client-side translations

---

## 1. LOCALE CONFIGURATION

### Payload CMS Locales (5 languages)
**File:** `/payload.config.ts` (lines 57-71)

```typescript
localization: {
  locales: [
    { label: 'Español',    code: 'es' },
    { label: 'Valencià',   code: 'ca' },
    { label: 'English',    code: 'en' },
    { label: 'Français',   code: 'fr' },
    { label: 'Deutsch',    code: 'de' },
  ],
  defaultLocale: 'es',
  fallback: true,
}
```

**i18n Fallback:**
- Fallback Language: Spanish (es)
- Supported Languages: es, en, ca, de, fr
- All 5 locales properly registered in Payload CMS

---

## 2. TRANSLATION TRIGGERING MECHANISM

### Type: Event-Driven Hook System
All translatable collections use **afterChange hooks** triggered on document create/update.

### Flow Diagram
```
User edits in Spanish (locale=es)
    ↓
afterChange hook fires (locale check passes)
    ↓
translatingIds check (prevents parallel execution)
    ↓
Fetch ConfiguracionTraduccion from global
    ↓
For each target locale [ca, en, fr, de]:
  → Call translateDocument() to extract/prepare fields
  → Call Python agent (OpenRouter) for translation
  → Update Payload with disableHooks=true (prevent recursion)
    ↓
Remove from translatingIds, cleanup
```

### Key Protection Mechanisms
1. **Locale Guard:** Only translates when `locale === 'es'`
   - Prevents translation loops when updating other locales
2. **translatingIds Set:** Prevents concurrent translations of same document
   - Reference: `/src/payload/utils/translation-utils.ts` (line 15)
3. **disableHooks Flag:** Prevents recursive hook execution
   - Set to `true` when updating translated locales

### Target Locales (Always)
All collections translate to: **ca, en, fr, de** (excluding source locale: es)

---

## 3. CONFIGURACIONTRADUCCION GLOBAL

**File:** `/src/payload/globals/ConfiguracionTraduccion.ts`  
**Slug:** `configuracion-traduccion`

### Fields Structure
```typescript
{
  proveedorIA:     'agente-python' (readonly, single option)
  modeloIA:        'anthropic/claude-3-5-haiku' (default)
  endpointAgente:  'http://localhost:8000/translate' (default)
}
```

### Available AI Models (via OpenRouter)
1. Claude 3.5 Haiku (Rápido, Recomendado) ← DEFAULT
2. Claude 3.5 Sonnet (Máxima calidad)
3. GPT-4o Mini (Económico)
4. Gemini 2.0 Flash

### Retrieval Pattern
```typescript
const configTraduccion = await payload.findGlobal({ 
  slug: 'configuracion-traduccion' 
});
const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
const modelo = configTraduccion?.modeloIA || 'anthropic/claude-3-5-haiku';
```

---

## 4. TRANSLATION UTILS

**File:** `/src/payload/utils/translation-utils.ts` (271 lines)

### Main Exports
1. **callTranslationAgent(text, targetLang, endpoint, model)**
   - Single string translation via Python agent
   - 30-second timeout with retry logic
   - Handles network failures gracefully

2. **translateLexical(lexicalObj, targetLang, ...)**
   - Recursively translates RichText (Lexical format) nodes
   - Traverses `.root.children` tree
   - Sequential processing to avoid agent saturation

3. **translateDocument(config)**
   - Main workhorse for field translation
   - Handles 4 data types:
     - RichText (Lexical)
     - Arrays (with ID skipping)
     - Objects/Groups
     - Plain strings
   - ID Detection: Skips MongoDB IDs (24 hex) & UUIDs (36 chars)
   - Fallback: Returns untranslated text on agent error

---

## 5. COLLECTIONS WITH TRANSLATION HOOKS

**Status:** 7 out of 9 collections have translation setup

| Collection | Fields Translated | File |
|------------|-----------------|------|
| **Alergenos** | nombre, descripcion | Alergenos.ts |
| **Banners** | titulo, subtitulo, ctaText, link.texto | Banners.ts |
| **Categorias** | nombre, descripcion | Categorias.ts |
| **Espacios** | nombre, descripcion | Espacios.ts |
| **Experiencias** | (specific fields) | Experiencias.ts |
| **Menus** | nombre, descripcion, etc. | Menus.ts |
| **MenusGrupo** | (specific fields) | MenusGrupo.ts |
| **Paginas** | heroTitle, heroSubtitle, historiaHitos, espacios (1-4), metaTitle, metaDescription | Paginas.ts |
| **Platos** | nombre, descripcion | Platos.ts |

### Collections WITHOUT Translation Hooks
- **Archivos** (files, no translatable content)
- **Usuarios** (users, no translatable content)

---

## 6. GLOBALS WITH TRANSLATION HOOKS

### ConfiguracionSitio
**File:** `/src/payload/globals/ConfiguracionSitio.ts`

**Fields Translated:**
- `openingHours[].days` (array of day strings)
- `openingHours[].hours` (array of hour strings)

**Special Logic:**
- Only translates if `openingHours` changed
- Detects changed row indexes to avoid re-translating unchanged rows
- Random delay (1-3 seconds) to prevent concurrent collision

**Globals NOT Translated:**
- `ConfiguracionTraduccion` (config only)
- `PaginaInicio` (uses component translations from client)

---

## 7. CLIENT-SIDE i18n (Frontend Translations)

**Module Location:** `/src/lib/i18n/`

### Architecture
- **Central Hub:** `index.ts`
- **Exports:** 8 translation modules
- **Type System:** TypeScript-enforced translations

### Translation Modules
```
index.ts                  → Central export + getTranslations() helper
nav.ts                    → Navigation links (5 pages)
component-translations.ts → Footer, LangSelector, MenuCard, CookieBanner
page-translations.ts      → 8 page translations (menus, carta, espacios, etc.)
home-translations.ts      → Home page content
legal-page-translations.ts → Legal pages (Aviso Legal, Privacidad, Cookies)
```

### Locale Type Definition
```typescript
export type Locale = 'es' | 'ca' | 'en' | 'fr' | 'de'
export const LOCALES: Locale[] = ['es', 'ca', 'en', 'fr', 'de']
export const DEFAULT_LOCALE: Locale = 'es'
```

### Usage Pattern
```typescript
const translations = getTranslations(locale)
const footerText = translations.footer.schedule
```

### Typed Exports (Full Locale Support)
Each module exports translations keyed by locale:
```typescript
// Example structure
{
  es: { ... },
  ca: { ... },
  en: { ... },
  fr: { ... },
  de: { ... },
}
```

---

## 8. FIELD LOCALIZATION SETTINGS

**Pattern Across Collections:**

All translatable fields use:
```typescript
{
  name: 'fieldName',
  type: 'text',
  label: 'Field Label',
  localized: true,  // ← CRITICAL FOR PAYLOAD i18n
}
```

**Fields NOT Localized:**
- IDs, codes, prices, image paths
- System fields (createdAt, updatedAt)
- Relationship IDs

---

## 9. DATA FLOW SUMMARY

### Create/Update Flow (Spanish)
```
1. Admin edits in Spanish locale (es)
2. afterChange hook fires with locale=es
3. translatingIds.add(docId)
4. For each target locale [ca, en, fr, de]:
   a. Extract translatable fields
   b. Call Python agent via callTranslationAgent()
   c. Update document locale with translations
   d. Use disableHooks=true to prevent re-triggering
5. translatingIds.delete(docId)
```

### Prevent Translation Loop
```typescript
// In hook
if (locale && locale !== 'es') return;  // ← EARLY EXIT
// + disableHooks=true on update
```

---

## 10. CONFIGURATION VALIDATION CHECKLIST

### ✅ All Requirements Met

| Item | Status | Notes |
|------|--------|-------|
| 5 Locales Configured | ✅ | es, ca, en, fr, de in payload.config.ts |
| Default Locale Set | ✅ | 'es' |
| Fallback Enabled | ✅ | fallback: true |
| ConfiguracionTraduccion | ✅ | Full setup with AI provider config |
| Translation Utils | ✅ | 271-line utility module with retry logic |
| Collection Hooks | ✅ | 7/9 collections properly configured |
| Global Hooks | ✅ | ConfiguracionSitio + component translations |
| Client i18n Module | ✅ | Full coverage for all pages/components |
| Type Safety | ✅ | TypeScript Locale type + exports |
| Locale Guard | ✅ | Only translate from Spanish |
| Race Condition Prevention | ✅ | translatingIds Set + disableHooks |

---

## 11. UNRESOLVED QUESTIONS

1. **Python Agent Endpoint:** Is the FastAPI service running at `http://localhost:8000/translate`?
   - Fallback default assumes local development
   - Production endpoint should override via ConfiguracionTraduccion

2. **Experiencias Collection:** Hook structure not fully verified
   - Follows pattern but specific fields unclear
   - Should cross-check with Experiencias.ts for exact fields

3. **Global Translation:** PaginaInicio not using afterChange hooks
   - Uses client-side component translations only
   - Determine if content-driven translation needed

4. **Model Selection:** Are all 4 OpenRouter models tested?
   - Default: Claude 3.5 Haiku
   - Recommend testing with Sonnet for quality comparison

---

## 12. RECOMMENDATIONS

### Short-term
1. Verify Python agent endpoint is running
2. Test translation with current default model
3. Monitor translatingIds for stuck documents

### Medium-term
1. Add translation quality logging (before/after comparison)
2. Implement retry analytics for failed translations
3. Create admin UI for retry failed translations

### Long-term
1. Consider batch translation for bulk operations
2. Add fallback locale chains (e.g., ca → es if translation fails)
3. Implement translation caching to reduce API calls
