# Debug Report: Missing Translations & Missing Dishes in Menu (Carta)

**Date**: 2026-03-11
**Reporter**: debugger agent
**Project**: Warynessy restaurant website (Next.js + Payload CMS v3 + Astro frontend)

---

## Executive Summary

Two reported issues investigated:

1. **Missing dishes** — 2 platos (ID 1, 3) and 2 categorias (ID 1, 35) deleted. **Root cause confirmed: manual deletion by `info@warynessy.com` on 2026-03-09.** Not a bug.

2. **Translations not showing in menu** — Local dev DB is correct (all 5 locales populated). **Root cause: production DB likely lacks non-ES translations.** Secondary risk: recent commit (694ae96) hardcodes `localhost:3000` which breaks SSR if production port ≠ 3000.

---

## Technical Analysis

### DB State — Local Dev (`warynessy_dev`)

| Table | Count | Notes |
|---|---|---|
| `platos` | 245 | IDs 1,3 deleted manually |
| `platos_locales` | 1225 rows (245 × 5 locales) | All locales: es, ca, en, fr, de |
| `categorias` | 33 | IDs 1,35 deleted manually |
| `categorias_locales` | 165 rows (33 × 5 locales) | All locales populated |
| `alergenos_locales` | 70 rows (14 × 5 locales) | All locales populated |

**Translation coverage**: 100% — every plato has `nombre` in all 5 locales. 104/245 platos have `descripcion` translated (rest have no description, which is correct).

### DB State — Backups (Production reference)

| Backup File | Platos | Has `_locales` tables? |
|---|---|---|
| `backup_prod_20260218_185136.sql` (Feb 18) | 247 | NO — `nombre` was direct column in `platos` |
| `backup_sin_traducciones_20260218.sql` (Feb 18) | 247 | NO |
| `dokploy_data.sql` (Feb 17) | 247 | NO |

**Key finding**: All 3 backups predate the localization migration. In the Feb 2026 schema, `platos.nombre` was a direct VARCHAR column. After localization was enabled (`localized: true` in Platos collection), Payload auto-created `platos_locales` via `push: true`.

### Issue 1: Deleted Dishes — Confirmed Manual Deletions

Evidence from `backup_deltas`:

```
id=7202 | platos      | id=1 | DELETE | info@warynessy.com | 2026-03-09 22:36:32
id=7203 | platos      | id=3 | DELETE | info@warynessy.com | 2026-03-09 22:36:43
id=7204 | categorias  | id=1 | DELETE | info@warynessy.com | 2026-03-09 22:36:57
id=7207 | categorias  | id=35| DELETE | info@warynessy.com | 2026-03-09 22:40:08
```

**Deleted content (recovered from `backup_deltas.previous_data`):**
- Plato ID=1: "Jamón Ibérico de Bellota" (€28, Entrantes, activo=true, destacado=true)
- Plato ID=3: "Ensalada de Burrata" (€16, Entrantes, activo=true)
- Categoria ID=1: "Entrantes" (slug=entrantes, orden=1)
- Categoria ID=35: "Vinos sin Alcohol" (slug=vinos-sin-alcohol)

**NO bug.** These were deliberate admin deletions. The translate-all operation did NOT cause data loss (it only creates updates, never deletes).

### Issue 2: Translations Not Showing — Root Cause Analysis

**Code path (correct):**
1. `/en/carta` → `Astro.params.lang = 'en'` → `locale = 'en'`
2. `getPlatos(true, 'en')` → `buildQuery({...}, 'en')` → `?locale=en`
3. REST call: `GET /api/platos?where=...&locale=en&depth=2&limit=500`
4. Payload returns `platos_locales.nombre` where `_locale = 'en'`
5. DishListItem renders `{plato.nombre}` (locale-aware from API)

**Local dev: works correctly.** Verified with direct SQL:
```sql
-- Returns English translations:
SELECT _locale, nombre FROM platos_locales WHERE _locale = 'en' LIMIT 3;
-- Homemade Iberian ham croquette (unit)
-- Sea Bass a la Espalda
-- House Russian salad
```

**Production — Two likely failure modes:**

**A) Production DB has no EN/CA/FR/DE translations (Most Likely)**
- All 3 backups predate localization → production DB may have the new schema (Payload auto-synced via `push: true`) but empty non-ES locale rows
- `translate-all` was run on local dev but NOT on production
- With `localization.fallback: true` in `payload.config.ts`, Payload returns Spanish for all locales
- **This matches the user symptom**: dishes show in Spanish on all locale pages

**B) PORT MISMATCH after commit 694ae96 (Critical Secondary Risk)**
- Commit `694ae96` (2026-03-10) hardcoded `const API_URL = 'http://localhost:3000/api'` in `payload-local.ts`
- Production 'payload' container runs with `PORT=3001` (from `compose.dokploy.yml`)
- If this commit is deployed: Astro SSR calls `localhost:3000/api` but server is on `3001` → connection refused → ALL data fails
- Commit message says deploy is manual (CI doesn't auto-deploy) → may or may not be deployed

**C) Production schema mismatch (Less Likely)**
- If production DB still has old schema (`platos.nombre` as direct column), Payload would error or fall back

---

## Backup Assessment

All available backups are from **before localization** (Feb 2026). They cannot be used to restore translated data. The local dev DB is the most complete data source.

---

## Recommended Fix Actions (Priority Order)

### P0 — Verify Production DB State (Immediate)

Connect to production DB at `72.62.183.215:5436/warynessy` and run:
```sql
-- Check if platos_locales table exists
SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%platos%';

-- Check translation coverage
SELECT _locale, COUNT(*) FROM platos_locales GROUP BY _locale;
```

### P1 — Run translate-all in Production (if translations missing)

If production DB has `platos_locales` table but empty non-ES rows:
1. Ensure `GOOGLE_API_KEY` is set in production env vars
2. Hit the translate-all endpoint: `GET https://warynessy.com/api/translate-all?secret=<PAYLOAD_SECRET>`
3. This will populate translations for all platos, categorias, menus, espacios, paginas

If production DB does NOT have `platos_locales` table (old schema):
1. Restart the production Payload server (it will auto-sync schema via `push: true`)
2. Then run translate-all as above

### P2 — Fix PORT Mismatch in payload-local.ts (Critical if 694ae96 deployed)

The hardcoded `localhost:3000` breaks SSR if production server port ≠ 3000. Fix:

```typescript
// src/lib/payload-local.ts
// Use PORT env var to support any server port
const PORT = process.env.PORT || '3000'
const API_URL = `http://localhost:${PORT}/api`
```

This ensures SSR API calls always hit the correct port regardless of production config.

### P3 — Restore Deleted Content (Optional)

The deleted dishes can be re-created from backup data. Data from `backup_deltas`:

**Plato ID=1 "Jamón Ibérico de Bellota"**: precio=28, categoria=Entrantes, activo=true, destacado=true, orden=1
**Plato ID=3 "Ensalada de Burrata"**: precio=16, categoria=Entrantes, activo=true, alergenos=[Lácteos], orden=3, descripcion="Burrata fresca con tomate cherry, rúcula y reducción de módena"

Note: Categoria "Entrantes" (ID=1) was also deleted. It must be recreated first before the platos can reference it. If "Entrantes" was intentionally removed, the platos can be placed in another category.

**Categoria ID=35 "Vinos sin Alcohol"**: slug=vinos-sin-alcohol, orden=1, activa=true
(This appears to be a wine subcategory — check if intentionally removed)

### P4 — Dump Production DB for Reference

Take a fresh production DB dump to understand current state:
```bash
pg_dump postgresql://warynessy:<PASS>@72.62.183.215:5436/warynessy \
  -t platos -t platos_locales -t categorias -t categorias_locales \
  > prod_backup_$(date +%Y%m%d).sql
```

---

## Supporting Evidence

### Platos Locales Data Sample (Local Dev, Correct State)
```
_locale | nombre                                          | _parent_id
--------+-------------------------------------------------+-----------
fr      | Croquette maison au jambon ibérique (pièce)    | 2
en      | Homemade Iberian ham croquette (unit)           | 2
de      | Hausgemachte Krokette vom Iberico-Schinken...   | 2
ca      | Croqueta casolana de pernil ibèric (unitat)     | 2
es      | Croqueta casera de jamón ibérico (unidad)       | 2
```

### Categorias Locales Data Sample (Local Dev, Correct State)
```
_locale | nombre                   | _parent_id
--------+--------------------------+-----------
es      | Carnes                   | 2
ca      | Carns                    | 2
en      | Meats                    | 2
es      | Pescados                 | 3
ca      | Peixos                   | 3
en      | Fish                     | 3
```

### Payload Config Localization Settings
```typescript
// payload.config.ts
localization: {
  locales: ['es', 'ca', 'en', 'fr', 'de'],
  defaultLocale: 'es',
  fallback: true,  // ← Falls back to 'es' if locale data missing
}
```

---

## Unresolved Questions

1. **What is the exact state of the production DB?** Cannot connect directly. P0 action requires checking if `platos_locales` exists and has data in production.

2. **Was commit 694ae96 deployed to production?** If yes, production may have 502 errors on all data fetching. Need to verify current deployed version in Dokploy.

3. **Were the deletions (platos 1,3 and categorias 1,35) intentional?** The admin deliberately deleted "Entrantes" category and 2 dishes. Was this a conscious decision or an accident? If accidental, P3 action applies.

4. **Was "Vinos sin Alcohol" (categoria 35) intentionally removed?** If yes, no action needed. If no, should be recreated.

5. **Is the `web` container (PORT=4321) actually deployed in Dokploy alongside the `payload` container?** The compose.dokploy.yml shows both services but it's unclear if both are deployed. This affects the PORT mismatch analysis.
