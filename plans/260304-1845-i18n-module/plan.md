# Plan: Módulo i18n Centralizado (Sprint 2)

**Fecha**: 2026-03-04
**Rama**: `i18n`
**Estado**: Pendiente de implementación

## Contexto (Sprint 1 completado el 23/2/2026)

- ✅ Payload CMS localización configurada (5 locales: es, ca, en, fr, de)
- ✅ `astro.config.mjs` i18n con `prefixDefaultLocale: true`
- ✅ Colecciones localizadas: Platos, Categorias, Menus, Espacios, Paginas
- ✅ Globals localizados: PaginaInicio, ConfiguracionSitio
- ✅ Routing `[lang]/*.astro` implementado

## Estado real verificado (2026-03-04)

| Item | Estado |
|------|--------|
| Platos/Categorias/Menus/Espacios localized | ✅ OK |
| Banners — titulo, texto | ❌ Falta `localized: true` |
| Experiencias — titulo, descripcion, resumen | ❌ Falta `localized: true` |
| MenusGrupo — nombre | ❌ Falta `localized: true` |
| `src/lib/i18n.ts` | ❌ No existe |
| BaseLayout `<html lang>` dinámico | ❌ Hardcodeado `"es"` |
| Strings UI en páginas/componentes | ❌ Inline en cada archivo |

## Objetivo

Crear `src/lib/i18n.ts` como fuente única de verdad para strings de UI estáticos. El contenido dinámico (menús, platos) ya viene localizado desde Payload.

---

## Fases

| Fase | Descripción | Estado | Prioridad |
|------|-------------|--------|-----------|
| [Phase 1](./phase-01-i18n-module.md) | Crear `src/lib/i18n.ts` con todas las traducciones UI | Pendiente | Alta |
| [Phase 2](./phase-02-baselayout-fix.md) | Fix `<html lang>` dinámico en BaseLayout | Pendiente | Alta |
| [Phase 3](./phase-03-refactor-components.md) | Refactorizar Header, Footer, LanguageSelector, MenuCard, CookieBanner | Pendiente | Alta |
| [Phase 4](./phase-04-refactor-pages.md) | Refactorizar páginas [lang]/*.astro | Pendiente | Media |
| [Phase 5](./phase-05-payload-schema-fixes.md) | Añadir `localized: true` a Banners, Experiencias, MenusGrupo | Pendiente | Media |

## Dependencias

- Phase 1 → bloquea Phase 3 y Phase 4
- Phase 2 → independiente
- Phase 5 → independiente

## Fuera de Scope

- Hooks de traducción automática — ya funcionan
- Script DeepL — ya documentado en Sprint 1
- Migración a librería i18n externa — overkill para 5 locales
- Modularizar index.astro en sub-componentes — fase futura
