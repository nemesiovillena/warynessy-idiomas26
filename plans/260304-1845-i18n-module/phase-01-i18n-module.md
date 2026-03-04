# Phase 1: Crear `src/lib/i18n.ts`

**Prioridad**: Alta
**Estado**: Pendiente
**Bloquea**: Phase 3, Phase 4

## Descripción

Crear el módulo central de traducciones de UI que reemplazará todos los objetos `_t`, `t`, `ui`, `uiLabels` dispersos por el código. Solo cubre strings estáticos de interfaz — el contenido dinámico viene de Payload CMS.

## Archivos relacionados

**Leer (fuente de verdad de traducciones actuales)**:
- `src/pages/[lang]/index.astro` — objeto `_t` (referencia principal)
- `src/components/ui/Header.astro` — ternarios para navLinks
- `src/components/ui/Footer.astro` — objeto `_t`
- `src/components/ui/LanguageSelector.astro` — `selectLangLabel`
- `src/pages/[lang]/menus.astro` — objeto `t`
- `src/pages/[lang]/carta.astro` — objeto `ui`
- `src/pages/[lang]/contacto.astro` — objeto `t`
- `src/pages/[lang]/espacios.astro` — objeto `t`
- `src/pages/[lang]/menus/[slug].astro` — objeto `t`
- `src/components/content/MenuCard.astro` — objeto `uiLabels`

**Crear**:
- `src/lib/i18n.ts`

**No modificar** en esta fase (se hace en Phase 3/4).

## Locales soportados

`es` (default) | `ca` | `en` | `fr` | `de`

## Arquitectura del módulo

```typescript
// src/lib/i18n.ts

export type Locale = 'es' | 'ca' | 'en' | 'fr' | 'de'
export const LOCALES: Locale[] = ['es', 'ca', 'en', 'fr', 'de']
export const DEFAULT_LOCALE: Locale = 'es'

// Tipo inferido del objeto de traducciones
type Translations = typeof translations.es

const translations = {
  es: { ... },
  ca: { ... },
  en: { ... },
  fr: { ... },
  de: { ... }
}

// Helper principal: devuelve traducciones para un locale
export function getTranslations(locale: string): Translations {
  return translations[(locale as Locale)] ?? translations[DEFAULT_LOCALE]
}

// Helper para nav links
export function getNavLinks(locale: string): { name: string; href: string }[] { ... }
```

## Categorías de strings a centralizar

### `nav` — Navegación
- carta, menus, reservas, contacto, experiencias

### `common` — Comunes
- cerrar, ver_mas, cargar, error, exito
- reservar, comprar

### `home` — Página inicio
- schedule, goToReservations, giftTitle, giftDesc, buyGiftCard
- spacesTitle, spacesDesc, discoverSpaces, closed
- heroTitle, heroSubtitle, bookTable, storyTitle, storyText
- reviewsTitle, reviewsSource, loadingReviews
- instagramTitle, viewInstagram, loadingInstagram
- restaurantInterior, restaurantSpace

### `menus` — Página menús
- Traducciones de la página de listado de menús y detalle

### `carta` — Página carta/platos
- Categorías, alérgenos, etiquetas de platos

### `espacios` — Página espacios

### `contacto` — Formulario de contacto

### `footer` — Footer

### `langSelector` — Selector de idioma

### `menuCard` — Componente tarjeta de menú

### `cookieBanner` — Banner de cookies

## Pasos de implementación

1. Leer todos los archivos fuente listados arriba para extraer strings
2. Consolidar en `src/lib/i18n.ts` sin duplicados
3. Tipar con `typeof translations.es` para autocompletado TypeScript
4. Exportar `getTranslations(locale)`, `getNavLinks(locale)`, `LOCALES`, `DEFAULT_LOCALE`, `type Locale`
5. NO modificar archivos consumidores todavía

## Criterio de éxito

- `src/lib/i18n.ts` compila sin errores TypeScript
- Todas las traducciones de todos los archivos fuente están incluidas
- `getTranslations('es')` devuelve el objeto completo con tipos correctos
- El módulo tiene menos de 200 líneas (si lo supera, dividir por dominio en `src/lib/i18n/`)

## Consideración de modularización

Si el archivo supera 200 líneas, dividir así:
```
src/lib/i18n/
├── index.ts          — re-exporta todo, helper getTranslations()
├── nav.ts            — navLinks
├── home.ts           — página inicio
├── pages.ts          — menus, carta, espacios, contacto
└── components.ts     — footer, menuCard, langSelector, cookieBanner
```
