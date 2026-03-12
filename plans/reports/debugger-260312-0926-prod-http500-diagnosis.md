# Diagnóstico: warynessy.com HTTP 500 en Producción

**Fecha:** 2026-03-12 09:26
**Estado:** INVESTIGADO — Root cause identificado, fix pendiente
**Severidad:** ALTA — Sitio web público inaccesible

---

## Executive Summary

El sitio `https://warynessy.com/es/` devuelve HTTP 500 en todas las colecciones públicas. El CI/CD pipeline **nunca ha completado exitosamente** (36/36 runs fallidos), por lo que el deploy automático a Dokploy **nunca se ha ejecutado**. Los deploys manuales del pasado funcionaron pero no aplicaron las migraciones de BD pendientes correctamente, o bien el último deploy manual no se ejecutó en el contenedor activo.

**Root cause principal (más probable):** Migración `20260309_add_menus_grupo_contrasena` no aplicada en BD de producción — el `start.sh` ejecuta `payload migrate` pero si falla silenciosamente, Payload arranca con schema desincronizado y da 500 en queries.

**Root cause secundario:** CI/CD pipeline bloqueado por el check de migraciones seguras, impidiendo deploys automáticos.

---

## Estado de los Servicios

| Endpoint | HTTP | Diagnóstico |
|----------|------|-------------|
| `https://warynessy.com/` | 302 | Redirect a `/es/` — OK |
| `https://warynessy.com/es/` | 500 | Frontend falla |
| `https://warynessy.com/admin` | 200 | Payload admin OK |
| `GET /api/usuarios` | 403 | Auth check funciona — BD conectada |
| `GET /api/menus` | 500 | Colección pública falla |
| `GET /api/platos` | 500 | Colección pública falla |
| `GET /api/alergenos` | 500 | Colección pública falla |
| `GET /api/experiencias` | 500 | Colección pública falla |
| `GET /api/globals/configuracion-sitio` | 500 | Global falla |

**Patrón:** Solo las colecciones con `access: { read: () => true }` fallan. Las colecciones con auth funcionan. Esto indica que el problema es en las queries mismas, no en la conexión a BD.

---

## Causa Raíz — CI/CD Pipeline (bloqueante)

### Error Actual en GitHub Actions

**Último run:** `be58b12` (2026-03-11T23:42:34Z) — FAILURE
**Job fallido:** `📋 Verificar Código y Tipos`
**Step fallido:** `🔍 Verificar migraciones seguras`

```
❌ ERROR: Se encontraron operaciones peligrosas en migraciones posteriores:
src/migrations/20260209_191504_add_menus_grupo.ts:85:  DROP TABLE IF EXISTS "menus_grupo_rels" CASCADE;
src/migrations/20260209_191504_add_menus_grupo.ts:86:  DROP TABLE IF EXISTS "menus_grupo" CASCADE;
```

**Por qué falla el fix `be58b12`:**
El commit `fix(ci): exclude initial migration from DROP TABLE safety check` actualizó el check para excluir `*initial*`:
```bash
find src/migrations -name "*.ts" ! -name "*initial*" -exec grep -l "DROP TABLE..." {} \;
```
Pero `20260209_191504_add_menus_grupo.ts` NO se llama `*initial*` — contiene `DROP TABLE` en su función `down()` (rollback legítimo). El check también debería excluir este archivo o solo buscar en las funciones `up()`.

**Consecuencia:** Deploy automático nunca se ejecuta → Dokploy no recibe webhook → código no se despliega automáticamente.

### Historial de Runs (36 total, 0 exitosos)
```
2026-03-11T21:51 → 2026-03-11T23:42: 36 runs, todos fallidos
- 18 failures (CI/CD Pipeline + Release)
- 18 skipped (syncs - se saltan por depender del CI/CD)
```

---

## Causa Raíz — HTTP 500 en Producción

### Arquitectura del Deploy

El `compose.dokploy.yml` despliega **dos servicios**:
- `payload` (port 3001): Next.js + Payload CMS
- `web` (port 4321): Astro frontend

Pero los headers de respuesta de `/es/` muestran `x-powered-by: Next.js, Payload` — confirma que **Payload está sirviendo el frontend** (probablemente el servicio `web` no está activo o está redirigido).

### Secuencia de Startup del Contenedor

El `Dockerfile` crea un `start.sh`:
```sh
#!/bin/sh
echo "Running Payload migrations..."
npx payload migrate || echo "Migration failed or no migrations to run"
echo "Starting server..."
exec node server.js
```

El `|| echo "..."` hace que los errores de migración sean silenciosos — el servidor arranca aunque fallen las migraciones.

### Migraciones Pendientes en Producción

4 migraciones definidas en `src/migrations/index.ts`:
1. `20260115_120514_initial` — Schema inicial
2. `20260209_191504_add_menus_grupo` — Tabla menus_grupo (añadida 2026-02-09)
3. `20260218_192308` — ALTER platos.precio a varchar (añadida 2026-02-18)
4. `20260309_add_menus_grupo_contrasena` — Columna contrasena en menus_grupo (añadida 2026-03-09)

El reporte anterior (`verification-260312-0035`) menciona que el último deploy exitoso fue `63ae2af` de 2026-03-11T18:36. La migración `20260309` fue añadida el 2026-03-09, **antes de ese deploy**, por lo que debería estar aplicada.

### Hipótesis del 500

**Hipótesis A (más probable):** La tabla `menus_grupo` existe pero la migración `20260218_192308` (ALTER platos.precio a varchar) no se ejecutó o falló, causando que las queries a `platos` fallen con error de tipo. Y por cascada (joins/depth), afecta a otras colecciones.

**Hipótesis B:** Payload no puede conectarse a la BD en el momento de las queries públicas (race condition de startup) pero sí al admin (que cachea la conexión al inicio). **Poco probable** dado que `/api/usuarios` responde correctamente con 403.

**Hipótesis C:** El último deploy manual (mencionado en fix-260312-0046) triggeró el webhook de Dokploy pero el contenedor que se actualizó no aplicó las migraciones correctamente — el `payload migrate` falló silenciosamente por un timeout o error de BD.

**Hipótesis D:** El `compose.dokploy.yml` despliega `payload` en puerto 3001 pero el `start.sh` usa `PORT=3000`. El `payload-local.ts` usa `http://localhost:${PORT}/api` donde PORT viene de env. Si la variable PORT no está configurada correctamente en Dokploy, las llamadas SSR fallan.

---

## Evidencia Adicional

### Inconsistencia de Puertos

En `compose.dokploy.yml`:
```yaml
payload:
  environment:
    PORT: 3001
  expose:
    - "3001"
```

En `payload-local.ts`:
```typescript
const PORT = process.env.PORT || '3000'
const API_URL = `http://localhost:${PORT}/api`
```

Si `PORT=3001` en el contenedor, el `payload-local.ts` construye `http://localhost:3001/api`. Esto debería funcionar si es el mismo contenedor sirviendo todo. **Pero si el servicio `web` (Astro) está separado**, usaría `localhost:3001` apuntando a sí mismo (no a payload), causando errores.

El `compose.dokploy.yml` tiene servicio `web` con `PORT: 4321` — en ese contenedor `payload-local.ts` construiría `http://localhost:4321/api` — eso sería incorrecto (4321 es Astro, no Payload).

### Verificación de que es Payload respondiendo a /es/

La respuesta a `/es/` incluye `x-powered-by: Next.js, Payload` y headers CORS de Payload. Esto confirma que **es el contenedor Payload** quien sirve las rutas SSR, no el servicio `web` separado.

---

## Acciones Recomendadas (Prioridad)

### 1. URGENTE: Fix del CI/CD Migration Check

**Problema:** El check bloquea `down()` functions que contienen DROP TABLE (rollback legítimo).

**Fix en `.github/workflows/ci-cd-payload.yml` línea 77:**
```bash
# ACTUAL (incorrecto)
find src/migrations -name "*.ts" ! -name "*initial*" -exec grep -l "DROP TABLE\|..." {} \;

# CORRECTO: Solo verificar en funciones up(), no down()
# Buscar DROP TABLE solo fuera de funciones down()
for f in $(find src/migrations -name "*.ts" ! -name "*initial*"); do
  # Extraer solo la función up() y verificar
  awk '/^export async function up/,/^export async function down/' "$f" | \
    grep -qE "DROP TABLE|DROP SCHEMA|DELETE FROM|TRUNCATE" && echo "$f"
done | grep -q . && exit 1
```

**Alternativa más simple:** Excluir también `*add_menus_grupo*`:
```bash
find src/migrations -name "*.ts" ! -name "*initial*" ! -name "*add_menus_grupo*" -exec ...
```

**NOTA:** Este fix no resuelve el 500 en producción, pero restaura el pipeline para futuros deploys.

### 2. URGENTE: Diagnosticar BD de Producción

Acceder a la BD de producción vía Dokploy panel y ejecutar:
```sql
-- Verificar migraciones aplicadas
SELECT * FROM payload_migrations ORDER BY created_at;

-- Verificar tablas existentes
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Verificar columna contrasena en menus_grupo
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'menus_grupo';

-- Verificar tipo de columna precio en platos
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'platos' AND column_name = 'precio';
```

### 3. URGENTE: Trigger Manual de Migraciones

Si las migraciones no están aplicadas:

**Opción A - Via Dokploy terminal:**
```bash
# En el contenedor payload en Dokploy
npx payload migrate
```

**Opción B - Redeploy forzando migraciones:**
En Dokploy, hacer redeploy del servicio `payload`. El `start.sh` ejecutará `npx payload migrate` al arrancar.

### 4. Verificar Configuración de Puertos en Dokploy

Confirmar en el panel de Dokploy que las variables de entorno del servicio `payload` incluyen:
- `PORT=3001` (o el puerto correcto)
- `DATABASE_URL` apuntando a `72.62.183.215:5436`

Si el servicio `web` existe, verificar que `PUBLIC_PAYLOAD_API_URL` apunta a `https://warynessy.com/api` (externo) y que no usa `localhost`.

---

## Preguntas Sin Resolver

1. **¿Se ejecutaron correctamente las migraciones** en el último deploy manual (23:45 del 2026-03-11)?
2. **¿Están activos los dos servicios** (`payload` y `web`) en Dokploy o solo `payload`?
3. **¿Cuál fue el último commit desplegado** en el contenedor activo actualmente en producción?
4. **¿El `payload migrate` en start.sh tiene logs** en Dokploy que muestren si se ejecutó exitosamente?
5. **¿El error 500 existía ANTES de los commits de ayer** o se introdujo ayer?

---

## Timeline

| Hora | Evento |
|------|--------|
| 2026-03-09 19:41 | Migración `contrasena` añadida al repo |
| 2026-03-11 18:36 | Último deploy manual exitoso según reporte |
| 2026-03-11 21:51 | Primer run CI/CD fallido (ya fallaba) |
| 2026-03-11 22:51-23:43 | 36 runs más, todos fallidos |
| 2026-03-11 23:45 | Deploy manual triggerado vía webhook |
| 2026-03-12 08:35 | Verificación: HTTP 500 en producción |

