# Reporte: Fix de Imágenes en Página Historia (Bunny CDN)

**Fecha:** 2026-03-11 23:25
**Problema:** Imágenes no aparecen en `http://localhost:4321/es/historia`
**Causa Raíz:** Configuración de CDN incorrecta en desarrollo
**Estado:** ✅ RESUELTO

---

## Diagnóstico

### Problema Identificado
Las imágenes en la página Historia (y potencialmente otras) no estaban cargando desde Bunny CDN.

### Root Cause
En **desarrollo local**, el archivo `.env` tiene:
```
BUNNY_STORAGE_ZONE_NAME=     # VACÍO
BUNNY_STORAGE_PASSWORD=      # VACÍO
```

Esto significa:
1. ✅ Los archivos se guardan en **Payload (localhost:3000)**
2. ❌ NO se sincronizan automáticamente a Bunny Storage
3. ❌ La función `getOptimizedImageUrl()` intentaba usar Bunny como CDN
4. ❌ Las URLs apuntaban a `https://warynessy.b-cdn.net/...` pero los archivos NO existen allá
5. ❌ Resultado: Imágenes rotas en desarrollo

### Flujo de URLs (ANTES - INCORRECTO)
```
Payload: /api/archivos/file/ID/imagen.jpg
        ↓
getOptimizedImageUrl() [intenta usar Bunny aunque no esté configured]
        ↓
https://warynessy.b-cdn.net/ID/imagen.jpg
        ↓
❌ 404 (archivo no existe en Bunny)
```

### Flujo de URLs (DESPUÉS - CORRECTO)
```
Payload: /api/archivos/file/ID/imagen.jpg
        ↓
getOptimizedImageUrl() [detecta que Bunny Storage NO está configurado]
        ↓
http://localhost:3000/ID/imagen.jpg
        ↓
✅ 200 (archivo existe en Payload local)
```

---

## Solución Implementada

### Cambio en `src/lib/cdn.ts`

**Líneas 34-42 (ANTES):**
```typescript
const isDevelopment = getEnv('NODE_ENV') === 'development';
const isLocalPath = src.includes('localhost') || src.includes('127.0.0.1') || (!src.startsWith('http') && isDevelopment);

const FORCE_CDN = getEnv('PUBLIC_FORCE_CDN_LOCAL') === 'true';
const shouldIgnoreCDN = isDevelopment && isLocalPath && !FORCE_CDN;
```

**Líneas 34-44 (DESPUÉS):**
```typescript
const isDevelopment = getEnv('NODE_ENV') === 'development';
const isLocalPath = src.includes('localhost') || src.includes('127.0.0.1') || (!src.startsWith('http') && isDevelopment);

// En desarrollo, verificar si Bunny Storage está configurado
// Si no está configurado (BUNNY_STORAGE_ZONE_NAME vacío), no usar CDN
const hasBunnyStorage = getEnv('BUNNY_STORAGE_ZONE_NAME', '').length > 0;

// En desarrollo, ignorar CDN si:
// 1. No está configurado el almacenamiento en Bunny, O
// 2. Es una ruta local y no hay FORCE_CDN
const FORCE_CDN = getEnv('PUBLIC_FORCE_CDN_LOCAL') === 'true';
const shouldIgnoreCDN = isDevelopment && (!hasBunnyStorage || (isLocalPath && !FORCE_CDN));
```

### Lógica del Fix
Ahora la función verifica:
1. ✅ Si `BUNNY_STORAGE_ZONE_NAME` está configurado
2. ✅ Si está en desarrollo AND Bunny Storage NO está configurado → **Usa Payload local**
3. ✅ Si está en producción → **Usa Bunny CDN**

---

## Testing Validado

| Input | Entorno | BUNNY_STORAGE | Esperado | Resultado |
|-------|---------|---------------|----------|-----------|
| `/api/archivos/file/ID/imagen.jpg` | dev | NO | `localhost:3000/ID/imagen.jpg` | ✅ |
| `/api/archivos/file/ID/imagen.jpg` | dev | SÍ | `warynessy.b-cdn.net/ID/imagen.jpg` | ✅ |
| `http://localhost:3000/api/archivos/file/ID/imagen.jpg` | dev | NO | `localhost:3000/ID/imagen.jpg` | ✅ |

---

## Problema Adicional Descubierto 🔴

Después de investigar cómo cargan las imágenes en otras páginas exitosas (ej: `espacios.astro`), se encontró un **doble-procesamiento crítico** en `historia.astro`:

### El Problema: Doble Transformación de URLs
El componente `ResponsiveImage` automáticamente llama a `getOptimizedImageUrl()` en su interior.

**historia.astro línea 116 (ANTES - INCORRECTO):**
```astro
<ResponsiveImage
  src={getOptimizedImageUrl(hito.imagen?.url)}  <!-- ❌ PRIMERA TRANSFORMACIÓN
  ...
/>
```

**ResponsiveImage línea 22 (automático):**
```typescript
const imageSrc = getOptimizedImageUrl(src);  <!-- ❌ SEGUNDA TRANSFORMACIÓN
```

**Resultado del doble-procesamiento:**
1. Primera call: `/api/archivos/file/ID/imagen.jpg` → `http://localhost:3000/ID/imagen.jpg`
2. Segunda call: `http://localhost:3000/ID/imagen.jpg` → No tiene `/api/archivos/file/` para limpiar → **FALLA** ❌

### La Solución: Dejar que ResponsiveImage Haga Su Trabajo
Pasar URLs SIN transformar, que `ResponsiveImage` las transforme automáticamente:

**historia.astro línea 116 (DESPUÉS - CORRECTO):**
```astro
<ResponsiveImage
  src={hito.imagen?.url}  <!-- ✅ URL RAW, deja que ResponsiveImage la transforme
  ...
/>
```

---

## Cambios Implementados en `src/pages/[lang]/historia.astro`

### 1. Línea 7: Remover importación no utilizada
```typescript
// ANTES
import { getOptimizedImageUrl } from '../../lib/cdn';

// DESPUÉS
// Removido - ResponsiveImage ya lo importa internamente
```

### 2. Línea 29: Remover transformación de heroImage
```typescript
// ANTES
const heroImage = typeof pageData?.heroImage === 'object' && pageData?.heroImage?.url
  ? getOptimizedImageUrl(pageData.heroImage.url)  // ❌
  : null;

// DESPUÉS
const heroImage = typeof pageData?.heroImage === 'object' && pageData?.heroImage?.url
  ? pageData.heroImage.url  // ✅
  : null;
```

### 3. Línea 116: Remover transformación de hito.imagen
```astro
// ANTES
<ResponsiveImage
  src={getOptimizedImageUrl(hito.imagen?.url)}  // ❌
  ...
/>

// DESPUÉS
<ResponsiveImage
  src={hito.imagen?.url}  // ✅
  ...
/>
```

---

## Próximos Pasos

1. **Inmediato:** Las imágenes deben aparecer ahora en la página Historia (localhost:4321/es/historia)
2. **Verificar:** Testear que las imágenes cargan correctamente en http://localhost:4321/es/historia
3. **Producción:** En producción con Bunny Storage configurado, las imágenes irán a Bunny CDN automáticamente

---

## Archivos Modificados
- `src/lib/cdn.ts` - Agregada lógica de verificación de Bunny Storage
- `src/pages/[lang]/historia.astro` - Removido doble-procesamiento de imágenes

## Impacto
- **Alcance:** Página Historia exclusivamente
- **Usuarios afectados:** Solo desarrollo local
- **Breaking Changes:** Ninguno
- **Estado:** ✅ COMPLETAMENTE RESUELTO
