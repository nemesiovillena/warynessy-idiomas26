# Debugger Report: /api/menus & /api/platos "Something went wrong" (HTTP 500)

**Date**: 2026-03-12
**Slug**: menus-platos-api-500-error
**App ID**: lmXdN12f4gz89axMWZ6e8 (Dokploy)

---

## Executive Summary

The "Something went wrong" error on `/api/menus` and `/api/platos` is caused by **missing `_locales` tables in the production database**. Payload CMS v3 with localization (`push: true`) generates separate `{collection}_locales` tables for each localized field, but the migrations created during this debugging session **never included these locale tables**. The schema was partially reconstructed through manual endpoint calls using incorrect/incomplete DDL that created `timestamp` columns instead of `timestamp(3) with time zone`, and entirely omitted the `_locales` tables Payload requires.

A secondary issue is that `push: true` in `payload.config.ts` should auto-sync the schema on startup — but this was disabled as a workaround for the CSS loader error. Without migration execution, the DB is stuck in an incomplete state.

---

## Root Causes (ranked by likelihood)

### 1. Missing `_locales` tables (PRIMARY — HIGH CONFIDENCE)

Payload CMS v3 stores localized field values in separate `_locales` tables:
- `menus_locales` — stores `nombre`, `etiqueta`, `descripcion_menu`, `fechasDias`, `descripcion` per locale
- `platos_locales` — stores `nombre`, `descripcion` per locale
- `platos_etiquetas_locales` — for the nested `etiqueta` array field

When Payload tries to query `/api/menus`, it JOINs against `menus_locales`. If that table doesn't exist → PostgreSQL throws `relation "menus_locales" does not exist` → Payload catches it and returns generic "Something went wrong" (HTTP 500).

**Evidence:**
- Initial migration `20260115_120514_initial.ts` has NO `_locales` tables anywhere (0 matches for `_locales` or `_locale`)
- `fix-payload-tables` endpoint manually created some `_locales` tables but only for `configuracion_sitio` and `pagina_inicio`, NOT for `menus` or `platos`
- `Menus.ts` has 5 localized fields; `Platos.ts` has 3 localized fields + nested array with localized field
- Payload v3 (3.74.0) with `localization` config + `@payloadcms/db-postgres` uses `_locales` table pattern
- Other endpoints (not localized collections) reportedly work fine — consistent with locale tables being missing only for these collections

### 2. `timestamp` vs `timestamp(3) with time zone` column type mismatch (SECONDARY)

The `run-initial-migration` endpoint created tables with plain `timestamp` instead of `timestamp(3) with time zone`. After the user "fixed timestamps to `timestamp with time zone`", Payload may generate queries with timezone-aware timestamp casting that fails on plain `timestamp` columns. But this is less likely to cause "Something went wrong" vs. a schema column error.

**Evidence:**
- `run-initial-migration/route.ts` line 46: `"updated_at" timestamp DEFAULT now() NOT NULL` — wrong type
- Official migration `20260115_120514_initial.ts` uses: `"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL`
- The task description says "timestamps converted to `timestamp with time zone`" — this may have been applied already

### 3. `push: true` disabled in practice (CONTRIBUTING)

`payload.config.ts` has `push: true` which should auto-create/sync all tables including `_locales` tables on startup. But:
- The CSS loader error forced removal of `npx payload migrate` from Dockerfile
- `push: true` runs at Payload initialization, before any request, via `getPayload({ config })`
- If the app initializes correctly with `push: true`, it WOULD create `_locales` tables automatically
- The fact that it's still broken suggests either: (a) `push: true` isn't running due to initialization error, or (b) `push: true` doesn't create tables for collections that already partially exist

---

## Supporting Evidence

### Migration audit
```
src/migrations/20260115_120514_initial.ts  — no _locales tables
src/migrations/20260209_191504_add_menus_grupo.ts — no _locales tables
src/migrations/20260218_192308.ts — only alters platos.precio type
src/migrations/20260309_add_menus_grupo_contrasena.ts — only adds column
```
None of the 4 migrations create `_locales` tables.

### Locale tables that WERE manually created (per fix-payload-tables endpoint)
- `configuracion_sitio_opening_hours_locales` ✅
- `configuracion_sitio_locales` ✅
- `pagina_inicio_locales` ✅
- `pagina_inicio_galeria_inicio_locales` ✅

### Locale tables that are MISSING (the broken ones)
- `menus_locales` ❌
- `platos_locales` ❌
- `platos_etiquetas_locales` ❌
- Possibly others for `categorias_locales`, `espacios_locales`, etc.

### CI/CD failures (GitHub Actions — latest run 23011252173)
```
src/app/api/sync-schema/route.ts(28,23): error TS2339:
  Property 'triggerInit' does not exist on type 'BasePayload'
src/app/api/sync-schema/route.ts(32,17): error TS2339:
  Property 'DatabaseAdapter' does not exist on type ...
```
TypeScript errors in debug endpoints prevent clean builds.

Release workflow (23011252175) also fails:
```
npm error Missing script: "lint"
```

---

## What `push: true` Should Do (but isn't)

With `push: true` in `postgresAdapter()`, Payload auto-executes schema sync on first `getPayload()` call. This WOULD create all missing tables including `_locales` tables. However:

1. On startup, `server.js` calls `getPayload({ config })` → Payload tries to connect to DB
2. If DB is in invalid state (partial schema, constraint violations) → init may fail silently
3. Even if init succeeds, `push: true` only ADDS missing tables — it won't fix type mismatches that PostgreSQL raises errors on

The correct fix is to let Payload's `push: true` run cleanly OR regenerate and apply the proper migration.

---

## Immediate Fix: Two Options

### Option A — Let `push: true` do its job (FASTEST)
The `push: true` in `payload.config.ts` should create all missing `_locales` tables automatically when Payload initializes. The issue may be that initialization is failing before it reaches schema sync.

**Steps:**
1. Hit `/api/sync-schema?secret=<PAYLOAD_SECRET>` — this calls `getPayload({ config })` which triggers `push: true`
2. Even though `triggerInit` method doesn't exist, the `getPayload()` call itself triggers schema push
3. Verify at `/api/init-config?secret=<PAYLOAD_SECRET>&action=diagnose` that tables appear
4. Test `/api/menus` and `/api/platos`

### Option B — Create `_locales` tables manually (MOST RELIABLE)
Add a new API endpoint or extend `/api/fix-payload-tables` to create the missing locale tables with correct schema.

Required tables for `menus` collection (based on Payload v3 convention):
```sql
CREATE TABLE IF NOT EXISTS "menus_locales" (
    "nombre" varchar,
    "etiqueta" varchar,
    "descripcion_menu" varchar,
    "fechas_dias" varchar,
    "descripcion" jsonb,
    "_locale" varchar NOT NULL,
    "_parent_id" integer NOT NULL,
    UNIQUE ("_locale", "_parent_id")
);
ALTER TABLE "menus_locales"
    ADD CONSTRAINT "menus_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "menus"("id") ON DELETE CASCADE;
```

Required tables for `platos` collection:
```sql
CREATE TABLE IF NOT EXISTS "platos_locales" (
    "nombre" varchar,
    "descripcion" varchar,
    "_locale" varchar NOT NULL,
    "_parent_id" integer NOT NULL,
    UNIQUE ("_locale", "_parent_id")
);
ALTER TABLE "platos_locales"
    ADD CONSTRAINT "platos_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "platos"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "platos_etiquetas_locales" (
    "etiqueta" varchar,
    "_locale" varchar NOT NULL,
    "_parent_id" varchar NOT NULL,
    UNIQUE ("_locale", "_parent_id")
);
ALTER TABLE "platos_etiquetas_locales"
    ADD CONSTRAINT "platos_etiquetas_locales_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "platos_etiquetas"("id") ON DELETE CASCADE;
```

**IMPORTANT:** The exact column names depend on Payload v3's internal schema generation for the field names. To get the exact DDL, run:
```bash
DATABASE_URL=<prod-url> npx payload generate:db-schema
```
or check the Payload v3 docs for localization table schema.

---

## Secondary Fixes (CI/CD)

### Fix 1 — TypeScript errors in `sync-schema/route.ts`
`payload.triggerInit()` doesn't exist on Payload v3 `BasePayload`. Replace with:
```typescript
const payload = await getPayload({ config });
// push: true in config already handles schema sync on getPayload() call
// No need for triggerInit()
```
Remove lines 28-33 from `src/app/api/sync-schema/route.ts`.

### Fix 2 — `npm run lint` missing in Release workflow
No `lint` script in `package.json`. Either add it or update the GitHub Actions Release workflow to skip/remove the lint step.

---

## Recommended Action Sequence

1. **Try Option A first**: call `/api/sync-schema?secret=X` on production — if `push: true` works, it will create all missing `_locales` tables
2. If Option A fails: implement Option B (create `_locales` tables manually via new endpoint)
3. After fixing DB: test `/api/menus` and `/api/platos` directly
4. Fix TypeScript errors in `sync-schema/route.ts` (remove `triggerInit` call)
5. Fix CI/CD lint script issue
6. Long term: add `menus_locales` and `platos_locales` to the official migration files

---

## Unresolved Questions

1. **Exact `_locales` column names**: Payload v3 may camelCase or snake_case the field names differently — need to verify via `generate:db-schema` or Payload internals
2. **Why `push: true` isn't auto-fixing this**: Is `getPayload()` actually being called on startup? Is `server.js` using a cached Payload instance that was initialized before `push: true` was set?
3. **`menus_locales` table existence**: Cannot confirm without direct DB access — the diagnosis endpoint doesn't check these specific tables. Need to run `action=diagnose` and inspect the full table list.
4. **Are other collections also broken?**: `espacios`, `categorias`, `experiencias`, `banners`, `paginas`, `alergenos` may also have missing `_locales` tables, but their endpoints may not be tested yet.
5. **Impact of recent "timestamps converted to `timestamp with time zone`" change**: Was this done on the production DB? If so, which tool was used and what columns were affected? Could have introduced column type mismatch vs. Payload's ORM expectations.
