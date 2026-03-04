# Phase 2: Fix `<html lang>` dinámico en BaseLayout

**Prioridad**: Alta
**Estado**: Pendiente
**Independiente**: no bloquea ni requiere otras fases

## Problema

`src/layouts/BaseLayout.astro` tiene:
```html
<html lang="es" class="scroll-smooth">
```

Hardcodeado en español — rompe SEO para `/ca/`, `/en/`, `/fr/`, `/de/`.

## Archivos

**Modificar**:
- `src/layouts/BaseLayout.astro`

**Leer** (para entender cómo llega el locale):
- `src/layouts/MainLayout.astro`
- Cualquier página `src/pages/[lang]/*.astro` que use BaseLayout

## Cambio

```diff
- const { title, description, image, schemaType = 'Restaurant', schemaData } = Astro.props;
+ const { title, description, image, schemaType = 'Restaurant', schemaData, locale } = Astro.props;

- <html lang="es" class="scroll-smooth">
+ <html lang={locale || 'es'} class="scroll-smooth">
```

Y en la interfaz Props:
```diff
  interface Props {
    title: string;
    description?: string;
    image?: string;
    schemaType?: 'Restaurant' | 'Menu' | 'Article';
    schemaData?: Record<string, any>;
+   locale?: string;
  }
```

## Propagación

Verificar que `MainLayout.astro` pase el locale a BaseLayout:
```astro
<BaseLayout locale={locale} ...>
```

Si MainLayout no recibe locale como prop, debe recibirlo y propagarlo.

## Criterio de éxito

- `npx tsc --noEmit` sin errores
- `<html lang="en">` en páginas inglesas, `<html lang="ca">` en catalanas, etc.
- No se rompe ninguna página existente
