// Central i18n module — re-exports all translations and helpers
export { getNavLinks, navReserveNow } from './nav'
export {
  footerTranslations,
  langSelectorTranslations,
  menuCardTranslations,
  cookieBannerTranslations,
} from './component-translations'
export {
  menusPageTranslations,
  cartaPageTranslations,
  espaciosPageTranslations,
  contactoPageTranslations,
  menuSlugTranslations,
} from './page-translations'
export { homeTranslations } from './home-translations'

export type Locale = 'es' | 'ca' | 'en' | 'fr' | 'de'
export const LOCALES: Locale[] = ['es', 'ca', 'en', 'fr', 'de']
export const DEFAULT_LOCALE: Locale = 'es'

import { homeTranslations } from './home-translations'
import {
  footerTranslations,
  langSelectorTranslations,
  menuCardTranslations,
  cookieBannerTranslations,
} from './component-translations'
import {
  menusPageTranslations,
  cartaPageTranslations,
  espaciosPageTranslations,
  contactoPageTranslations,
  menuSlugTranslations,
} from './page-translations'

// Composite translations object — typed from the Spanish (default) locale
const translations = {
  es: {
    home: homeTranslations.es,
    footer: footerTranslations.es,
    langSelector: langSelectorTranslations.es,
    menuCard: menuCardTranslations.es,
    cookieBanner: cookieBannerTranslations.es,
    menus: menusPageTranslations.es,
    carta: cartaPageTranslations.es,
    espacios: espaciosPageTranslations.es,
    contacto: contactoPageTranslations.es,
    menuSlug: menuSlugTranslations.es,
  },
  ca: {
    home: homeTranslations.ca,
    footer: footerTranslations.ca,
    langSelector: langSelectorTranslations.ca,
    menuCard: menuCardTranslations.ca,
    cookieBanner: cookieBannerTranslations.ca,
    menus: menusPageTranslations.ca,
    carta: cartaPageTranslations.ca,
    espacios: espaciosPageTranslations.ca,
    contacto: contactoPageTranslations.ca,
    menuSlug: menuSlugTranslations.ca,
  },
  en: {
    home: homeTranslations.en,
    footer: footerTranslations.en,
    langSelector: langSelectorTranslations.en,
    menuCard: menuCardTranslations.en,
    cookieBanner: cookieBannerTranslations.en,
    menus: menusPageTranslations.en,
    carta: cartaPageTranslations.en,
    espacios: espaciosPageTranslations.en,
    contacto: contactoPageTranslations.en,
    menuSlug: menuSlugTranslations.en,
  },
  fr: {
    home: homeTranslations.fr,
    footer: footerTranslations.fr,
    langSelector: langSelectorTranslations.fr,
    menuCard: menuCardTranslations.fr,
    cookieBanner: cookieBannerTranslations.fr,
    menus: menusPageTranslations.fr,
    carta: cartaPageTranslations.fr,
    espacios: espaciosPageTranslations.fr,
    contacto: contactoPageTranslations.fr,
    menuSlug: menuSlugTranslations.fr,
  },
  de: {
    home: homeTranslations.de,
    footer: footerTranslations.de,
    langSelector: langSelectorTranslations.de,
    menuCard: menuCardTranslations.de,
    cookieBanner: cookieBannerTranslations.de,
    menus: menusPageTranslations.de,
    carta: cartaPageTranslations.de,
    espacios: espaciosPageTranslations.de,
    contacto: contactoPageTranslations.de,
    menuSlug: menuSlugTranslations.de,
  },
}

// Translations type uses string (not literal) so all locales are assignable
export type Translations = {
  [K in keyof typeof translations.es]: {
    [F in keyof (typeof translations.es)[K]]: string
  }
}

// Returns full translations for a given locale, falls back to Spanish
export function getTranslations(locale: string): Translations {
  return (translations[locale as Locale] ?? translations[DEFAULT_LOCALE]) as Translations
}
