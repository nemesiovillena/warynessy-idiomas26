# Phase 5: Completar Schema de Payload CMS

**Prioridad**: Media
**Estado**: Pendiente
**Independiente**: no requiere otras fases

## Estado verificado (2026-03-04)

Platos ya tiene `localized: true` en `nombre` y `descripcion` ✅

Colecciones **pendientes** (Sprint 1 dijo que estaban, pero NO están):

### MenusGrupo.ts
- Campo `nombre` — falta `localized: true`

### Banners.ts
- Campo `titulo` — falta `localized: true`
- Campo `texto` — falta `localized: true`

### Experiencias.ts
- Campos `titulo`, `descripcion`, `resumen`, `incluye`, `validez` — faltan `localized: true`

## Archivos

**Modificar**:
- `src/payload/collections/MenusGrupo.ts`
- `src/payload/collections/Banners.ts`
- `src/payload/collections/Experiencias.ts`

## Cambio

```typescript
// Antes
{
  name: 'nombre',
  type: 'text',
  required: true,
}

// Después
{
  name: 'nombre',
  type: 'text',
  required: true,
  localized: true,
}
```

## Implicación de base de datos

Añadir `localized: true` a un campo existente hace que Payload cree columnas adicionales por locale en PostgreSQL (o use la tabla de localización dependiendo del adaptador).

Con `@payloadcms/db-postgres` y `push: true` activado en `payload.config.ts`, el schema se sincroniza automáticamente al arrancar. **Pero es recomendable crear una migración explícita** para documentar el cambio.

### Migración recomendada

```bash
npx payload migrate:create --name add_localized_fields_platos_menus_grupo
```

Verificar que la migración generada sea correcta antes de aplicar.

## Criterio de éxito

- `MenusGrupo.nombre`, `Banners.titulo/texto`, `Experiencias.*` tienen `localized: true`
- El servidor arranca sin errores de schema
- `npx tsc --noEmit` sin errores

## Riesgo

**Bajo**: Los datos existentes en español se mantienen. Los otros locales simplemente no tendrán valor hasta que el hook los traduzca (lo que ocurre en el próximo save o via `/api/translate-all`).
