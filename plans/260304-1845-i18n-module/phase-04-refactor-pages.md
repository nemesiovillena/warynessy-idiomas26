# Phase 4: Refactorizar Páginas [lang]/*.astro

**Prioridad**: Media
**Estado**: Pendiente
**Requiere**: Phase 1 completada

## Páginas a refactorizar

| Archivo | Objeto inline | Tamaño aprox |
|---------|--------------|--------------|
| `src/pages/[lang]/index.astro` | `_t` (5 locales × 20+ keys) | 534 líneas |
| `src/pages/[lang]/menus.astro` | `t` | ~150 líneas |
| `src/pages/[lang]/carta.astro` | `ui` | ~120 líneas |
| `src/pages/[lang]/contacto.astro` | `t` (~180 líneas de traducciones) | ~300 líneas |
| `src/pages/[lang]/espacios.astro` | `t` | ~120 líneas |
| `src/pages/[lang]/menus/[slug].astro` | `t` | ~100 líneas |

## Patrón de refactor

**Antes**:
```astro
---
const _t = {
  es: { schedule: "Horario", ... },
  ca: { schedule: "Horari", ... },
  en: { schedule: "Hours", ... },
  fr: { schedule: "Horaires", ... },
  de: { schedule: "Öffnungszeiten", ... }
}
const t = _t[locale as keyof typeof _t] ?? _t.es
---
```

**Después**:
```astro
---
import { getTranslations } from '../../lib/i18n';
const t = getTranslations(locale).home   // o .menus, .carta, etc.
---
```

## Nota sobre index.astro (534 líneas)

La modularización en componentes de sección (HeroSection, SpacesSection, etc.) es deseable pero **fuera de scope** de este plan — alargaría demasiado la fase. Solo se elimina el objeto `_t` inline. La reducción de líneas vendrá de quitar ~100 líneas de strings duplicados.

## Criterio de éxito

- Ningún objeto de traducciones inline en las 6 páginas
- `npm run build` sin errores
- Todas las páginas renderizan correctamente en los 5 idiomas
