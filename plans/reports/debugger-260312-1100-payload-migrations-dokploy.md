# Debugger Report: Payload Migrations Not Running in Dokploy

**Date:** 2026-03-12
**App:** app-parse-neural-bandwidth-yrxuth (warynessy.com)
**Runs analyzed:** 22996403230 (latest), 22995723788, 22995559735

---

## Executive Summary

Three distinct failures prevent migrations from running and the Docker image from deploying:

1. **PRIMARY (blocking migrations):** `npx payload migrate` crashes with `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"` — `tsx` ESM loader can't handle CSS imports from `react-image-crop` and `@payloadcms/richtext-lexical`. Migrations never run, neither in CI nor in the Docker container at startup.

2. **SECONDARY (blocking CI deploy trigger):** Dokploy webhook returns HTTP 401 `{"message":"Unauthorized"}` — the `DOKPLOY_PAYLOAD_TOKEN` secret updated at 09:42 is invalid/expired/wrong.

3. **TERTIARY (Release workflow):** `npm run lint` fails with "Missing script: lint" — Release workflow errors on every push to main.

Because the deploy trigger fails in CI, the Dokploy redeploy (ID: g6QLUPvAcplgmmXNFLOE5) was triggered manually, not via CI. That container will also fail its startup migrations for the same `.css` error.

---

## Issue 1 (Critical): CSS Extension Error in `npx payload migrate`

### Error
```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css" for
  node_modules/react-image-crop/dist/ReactCrop.css
  (also: @payloadcms/richtext-lexical/dist/field/bundled.css)

Node.js v20.20.0
```

### Root Cause
`payload migrate` uses `tsx` (ESM mode) to load `payload.config.ts`. The config likely imports a Payload component or plugin that transitively imports a `.css` file. Node.js ESM loader (even with `tsx`) cannot handle `.css` — they're not JavaScript modules.

The `start.sh` script in the Dockerfile runs `npx payload migrate` at container startup. Same error will occur there. The `|| true` pattern in start.sh suppresses the exit code:
```sh
if npx payload migrate; then
  echo "Migrations completed successfully"
else
  echo "⚠️  Migration failed or no migrations to run"
fi
# server starts regardless
```
Server starts, but **tables do not exist** → HTTP 500 on `/api/menus`, `/api/platos`.

### Evidence
- CI run 22996403230, job `🗄️ Ejecutar Migraciones`, step `📊 Ejecutar migraciones de Payload`:
  ```
  TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"
  ⚠️ No se encontró script 'migrate'
  ✅ Migraciones ejecutadas correctamente  ← FALSE POSITIVE
  ```
- The `|| echo "⚠️ ..."` mask causes the step to report success even when migrations failed.

### Impact
- DB tables `menus`, `configuracion_sitio`, etc. never created
- All public API endpoints return HTTP 500
- CI migration step reports "success" — deceptive

---

## Issue 2 (Critical): Dokploy Webhook 401 Unauthorized

### Error
```
Response: {"message":"Unauthorized"}
❌ Error al triggerear deploy de payload (HTTP 401)
```

### Root Cause
The `DOKPLOY_PAYLOAD_TOKEN` GitHub secret (updated 2026-03-12T09:42:01Z) is invalid. Either:
- Wrong token value was set
- The Dokploy deploy token was regenerated in the panel and the old value is stale
- Token format doesn't match what Dokploy's webhook endpoint expects as `refreshToken`

### Evidence
- Runs 22996403230, 22995723788, 22995559735 all fail identically at deploy step
- Secret was updated at 09:42 but still fails — value is wrong, not just missing
- `DOKPLOY_TRANSLATION_TOKEN` (updated 09:42:10) likely also invalid (step not reached due to first failure)

---

## Issue 3 (Minor): Release Workflow Missing `lint` Script

### Error
```
npm error Missing script: "lint"
Process completed with exit code 1.
```

### Root Cause
`package.json` has no `"lint"` script. The Release workflow at `.github/workflows/release.yml` calls `npm run lint` which does not exist.

### Impact
- Semantic release / npm publish never runs
- Cosmetic failure — does not block the actual deployment path (CI/CD pipeline)

---

## Fix Recommendations

### Fix 1 (Immediate): CSS import error in `payload migrate`

**Option A — Add CSS transform to `payload.config.ts` loading context**

The issue is `tsx` doesn't mock CSS. Payload's migrate CLI uses `tsx` internally. The fix is to ensure CSS files are ignored when loading the config for migrations.

Add a custom `--import` hook or use `NODE_OPTIONS` to intercept CSS:

In `package.json` migrate script:
```json
"migrate": "NODE_OPTIONS='--import ./scripts/css-ignore-loader.mjs' payload migrate"
```

Create `/scripts/css-ignore-loader.mjs`:
```js
import { register } from 'node:module';
// noop — handled by tsx's existing hooks + custom null loader below
```

**Simpler Option B** — Check if there's a Payload config flag to disable admin UI loading during migrations. Payload >= 3.x has `--config` flag.

**Option C (Recommended, most robust)** — Wrap in Docker: since migrations run inside the container where Next.js already built everything, run them via the compiled server. But `start.sh` already does this correctly via `npx payload migrate`. The real fix is to tell `tsx`/Node.js to ignore CSS files.

The cleanest solution: update `package.json`:
```json
"migrate": "node --import tsx/esm --experimental-loader ./scripts/null-css-loader.mjs node_modules/.bin/payload migrate"
```

Or check if newer `@payloadcms/db-postgres` version resolves this (CSS was imported via UI components loaded unnecessarily during migrate).

**Immediate workaround:** Manually run migrations against production DB from local machine where Next.js can resolve CSS:
```bash
DATABASE_URL=postgresql://warynessy:...@warynessy-db-idiomas26-gha8fq:5432/warynessy \
  npm run migrate
```

### Fix 2 (Immediate): Regenerate Dokploy Deploy Token

1. Go to Dokploy panel → app `app-parse-neural-bandwidth-yrxuth` → Settings → Deploy Webhook
2. Regenerate the token
3. Update GitHub secret `DOKPLOY_PAYLOAD_TOKEN` with the new token
4. Do the same for `DOKPLOY_TRANSLATION_TOKEN`

### Fix 3 (Quick): Add `lint` script to `package.json`

```json
"lint": "tsc --noEmit"
```
Or add eslint/next lint as appropriate. Prevents Release workflow from always failing.

---

## Timeline of Events

| Time | Event |
|------|-------|
| Prior | DB tables missing (menus, configuracion_sitio not created) |
| 09:38 | Push triggers CI — migrations fail (CSS error), deploy fails (401) |
| 09:42 | Dokploy tokens updated in GitHub secrets |
| 09:42 | New CI run — same failures persist (token still invalid) |
| 10:00 | Push `fix(docker): improve migration error logging in start.sh` |
| 10:00 | Latest CI run 22996403230 — same two failures |
| ~10:00 | Manual redeploy triggered in Dokploy (g6QLUPvAcplgmmXNFLOE5) |
| Now | Container running but migrations still failing at startup → HTTP 500 |

---

## Unresolved Questions

1. Is the Dokploy deploy token format `refreshToken` or a different field? Verify the exact webhook payload format in Dokploy docs.
2. Has the DB ever had migrations run successfully? If `payload_migrations` table exists but tables are missing, that's a different problem (partial migration).
3. What version of `@payloadcms/db-postgres` / `payload` is installed? Newer versions may have fixed the CSS import issue.
4. Can we SSH into the Dokploy host to check actual container logs for the manual redeploy?
