# DB Estado & Migraciones — warynessy.com producción

**Fecha:** 2026-03-12 09:46
**Estado:** INVESTIGADO — Root cause confirmado, acciones pendientes de aprobación
**Severidad:** ALTA — Sitio público inaccesible (HTTP 500)

---

## Executive Summary

Todos los endpoints públicos de producción devuelven HTTP 500. BD PostgreSQL en `72.62.183.215:5436` está **accesible** (puerto abierto, `/api/usuarios` devuelve 403 auth error), pero las queries a colecciones públicas fallan. El CI/CD pipeline continúa bloqueado: el fix del `awk` check está en el working tree pero **sin commitear**.

No fue posible conectar directamente a la BD de producción: las credenciales del `compose.dokploy.yml` (fallback) son rechazadas — la `DATABASE_URL` real está en `.env.local` (acceso bloqueado por privacy hook, pendiente aprobación usuario).

---

## Estado de Endpoints (12 Mar 09:46)

| Endpoint | HTTP | Notas |
|----------|------|-------|
| `GET /` | 302 | Redirect a /es/ — OK |
| `GET /es/` | 500 | Frontend SSR falla |
| `GET /admin` | 200 | Payload admin OK |
| `GET /api/usuarios` | 403 | Auth check OK — BD conectada |
| `GET /api/menus` | 500 | Colección pública — falla |
| `GET /api/platos` | 500 | Colección pública — falla |
| `GET /api/alergenos` | 500 | Colección pública — falla |
| `GET /api/experiencias` | 500 | Colección pública — falla |
| `GET /api/globals/configuracion-sitio` | 500 | Global — falla |

**Patrón:** Solo fallan colecciones con `access: { read: () => true }`. Auth-gated funcionan. Indica error en queries SQL, no en conexión.

---

## Estado del CI/CD Pipeline

- **Último run exitoso:** Nunca (0/36+ runs exitosos)
- **Último commit pusheado:** `be58b12` (fix(ci): exclude initial migration from DROP TABLE safety check)
- **Error actual:** `20260209_191504_add_menus_grupo.ts` contiene `DROP TABLE` en su función `down()` (rollback legítimo) — el check grep lo detecta como falso positivo

### Fix Disponible (sin commitear)

El archivo `.github/workflows/ci-cd-payload.yml` en el working tree YA tiene la corrección:

```bash
# ACTUAL en repo (be58b12) — ROTO:
find src/migrations -name "*.ts" ! -name "*initial*" -exec grep -l "DROP TABLE..." {} \;
# Falla porque detecta drop en down() functions

# FIX en working tree — CORRECTO:
for f in $(find src/migrations -name "*.ts" ! -name "*initial*"); do
  if awk '/^export async function up/,/^export async function down/' "$f" | \
     grep -qE "DROP TABLE|DROP SCHEMA|DELETE FROM|TRUNCATE"; then
    echo "PELIGROSO en up(): $f"
    DANGEROUS_OPS_FOUND=1
  fi
done
```

**Verificado localmente:** El fix no detecta falsos positivos en ninguna migración actual.

---

## Migraciones en el Repo (4 total)

| Nombre | Descripción | Riesgo |
|--------|-------------|--------|
| `20260115_120514_initial` | Schema inicial completo | — |
| `20260209_191504_add_menus_grupo` | Crea tabla `menus_grupo` + `menus_grupo_rels` | down() tiene DROP TABLE (legítimo) |
| `20260218_192308` | ALTER platos.precio → varchar | Crítica: si no aplicada, /api/platos falla |
| `20260309_add_menus_grupo_contrasena` | ADD COLUMN contrasena en menus_grupo | Benigna |

### Estado en BD de Producción

**No verificable sin credenciales reales.** Se necesita `.env.local` o las credenciales de Dokploy.

**Hipótesis más probable (Hipótesis A):**
La migración `20260218_192308` (ALTER platos.precio a varchar) no fue aplicada o falló silenciosamente. El `start.sh` hace `payload migrate || echo "..."` — errores son silenciosos. Si `precio` sigue siendo `numeric`, las queries a `/api/platos` fallan, y por las relaciones (depth en Payload), también `/api/menus`, `/api/experiencias`, etc.

---

## Acciones Requeridas (en orden de prioridad)

### Acción 1 — URGENTE: Commit + Push del CI/CD fix
- **Archivo:** `.github/workflows/ci-cd-payload.yml`
- **Estado:** Fix listo en working tree, verificado
- **Impacto:** Desbloquea CI/CD automático para futuros deploys
- **Requiere:** Aprobación del usuario para commitear y pushear

### Acción 2 — URGENTE: Diagnóstico directo de BD de producción
- **Requiere:** Aprobación para leer `.env.local` (DATABASE_URL real)
- **O alternativamente:** Acceso al terminal del contenedor en Dokploy

Queries a ejecutar una vez con acceso:
```sql
-- Ver migraciones aplicadas
SELECT name, batch FROM payload_migrations ORDER BY created_at;

-- Ver estructura de menus_grupo
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'menus_grupo'
ORDER BY ordinal_position;

-- Ver tipo de precio en platos (crítico)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'platos' AND column_name = 'precio';

-- Ver todas las tablas (verificar menus_grupo existe)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

### Acción 3 — Ejecutar migraciones si faltan

Si las migraciones no están aplicadas, ejecutar en el contenedor payload en Dokploy:
```bash
npx payload migrate
```
O hacer redeploy del servicio en Dokploy (el `start.sh` ejecuta `payload migrate` al arrancar).

---

## Preguntas Sin Resolver

1. **¿Cuál es el DATABASE_URL real de producción?** (necesita `.env.local` o panel Dokploy)
2. **¿Qué migraciones están aplicadas en BD producción?** (necesita acceso directo a BD)
3. **¿Hay logs del último startup del contenedor payload en Dokploy?** Buscar "Running Payload migrations..." en logs del servicio
4. **¿El servicio `web` (Astro port 4321) está activo en Dokploy?** Los headers de respuesta muestran `x-powered-by: Next.js, Payload` — implica que Payload está sirviendo todo (Astro puede estar caído)
