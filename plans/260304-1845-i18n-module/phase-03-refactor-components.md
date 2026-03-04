# Phase 3: Refactorizar Componentes UI

**Prioridad**: Alta
**Estado**: Pendiente
**Requiere**: Phase 1 completada

## Componentes a refactorizar

| Archivo | Problema actual | Cambio |
|---------|----------------|--------|
| `src/components/ui/Header.astro` | 25 ternarios anidados para navLinks | Usar `getNavLinks(locale)` de i18n.ts |
| `src/components/ui/Footer.astro` | Objeto `_t` inline (5 locales) | Usar `getTranslations(locale).footer` |
| `src/components/ui/LanguageSelector.astro` | Objeto `selectLangLabel` inline | Usar `getTranslations(locale).langSelector` |
| `src/components/content/MenuCard.astro` | Objeto `uiLabels` inline | Usar `getTranslations(locale).menuCard` |
| `src/components/ui/CookieBanner.astro` | Presumiblemente inline | Usar `getTranslations(locale).cookieBanner` |

## Patrón de refactor

**Antes** (Header.astro):
```astro
---
const navLinks = [
  {
    name: locale === 'es' ? "Carta" :
          locale === 'ca' ? "Carta" :
          locale === 'en' ? "Menu" :
          locale === 'fr' ? "Carte" : "Speisekarte",
    href: `/${locale}/carta`
  },
  // ... 4 más
];
---
```

**Después**:
```astro
---
import { getNavLinks } from '../../lib/i18n';
const navLinks = getNavLinks(locale);
---
```

**Antes** (Footer.astro):
```astro
---
const _t = {
  es: { ... },
  ca: { ... },
  en: { ... },
  fr: { ... },
  de: { ... }
}
const t = _t[locale as keyof typeof _t] ?? _t.es
---
```

**Después**:
```astro
---
import { getTranslations } from '../../lib/i18n';
const t = getTranslations(locale).footer
---
```

## Orden de implementación

1. `Header.astro` — mayor impacto visual, elimina 25 ternarios
2. `Footer.astro`
3. `LanguageSelector.astro`
4. `MenuCard.astro`
5. `CookieBanner.astro` — leer primero para extraer strings a i18n.ts si no están ya

## Criterio de éxito

- Ningún objeto `_t`, `t`, `ui`, `uiLabels` inline en los 5 componentes
- `npm run build` sin errores
- Todos los idiomas renderizan correctamente sus traducciones
