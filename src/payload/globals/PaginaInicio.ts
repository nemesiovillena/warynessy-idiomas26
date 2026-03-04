import type { GlobalConfig } from 'payload'
import { callTranslationAgent, translateLexical } from '../utils/translation-utils'

export const PaginaInicio: GlobalConfig = {
  slug: 'pagina-inicio',
  label: 'Página de Inicio',
  access: {
    read: () => true, // Public read access
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        // Solo si venimos de la versión en español
        if ((req as any).locale !== 'es') {
          console.log(`[PAGINA-INICIO] Saltando traducción automático (locale: ${(req as any).locale})`);
          return;
        }

        console.log(`[PAGINA-INICIO] Iniciando proceso de traducción automática...`);

        const payload = req.payload;
        const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
        const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
        const model = configTraduccion?.modeloIA;

        const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
        const fieldsToTranslate = [
          'heroTitle', 'heroSubtitle', 'welcomeTitle', 'welcomeText',
          'ctaTitle', 'ctaText', 'ctaButtonText', 'seoTitle', 'seoDescription'
        ];

        await Promise.all(targetLocales.map(async (locale) => {
          const translatedData: any = {};
          let hasTranslations = false;

          await Promise.all(fieldsToTranslate.map(async (field) => {
            const value = doc[field];
            if (!value) return;
            const prevValue = (previousDoc as any)?.[field];
            const changed = JSON.stringify(value) !== JSON.stringify(prevValue);
            if (!changed) return;
            try {
              // Si es RichText (Lexical)
              if (typeof value === 'object' && value !== null && value.root) {
                console.log(`[PAGINA-INICIO] Traduciendo RichText: ${field} al locale ${locale}...`);
                translatedData[field] = await translateLexical(value, locale, endpoint, model);
                hasTranslations = true;
              }
              // Si es texto plano
              else if (typeof value === 'string' && value.trim().length > 0) {
                console.log(`[PAGINA-INICIO] Traduciendo texto: ${field} al locale ${locale}...`);
                translatedData[field] = await callTranslationAgent(value, locale, endpoint, model);
                hasTranslations = true;
              }
            } catch (e) {
              console.error(`[PAGINA-INICIO] Error al traducir ${field} a ${locale}:`, e);
            }
          }));

          if (hasTranslations) {
            console.log(`[PAGINA-INICIO] Aplicando traducciones a locale ${locale}...`);
            try {
              await payload.updateGlobal({
                slug: 'pagina-inicio',
                data: translatedData,
                locale: locale as any,
              });
            } catch (updateErr) {
              console.error(`[PAGINA-INICIO] Error guardando locale ${locale}:`, updateErr);
            }
          }
        }));
      }
    ]
  },
  fields: [
    // Hero Section
    {
      name: 'heroTitle',
      type: 'text',
      label: 'Título Principal (Hero)',
      required: true,
      localized: true,
      admin: {
        description: 'Título principal de la página de inicio',
      },
    },
    {
      name: 'heroSubtitle',
      type: 'textarea',
      label: 'Subtítulo (Hero)',
      localized: true,
      admin: {
        description: 'Subtítulo o claim del restaurante',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      label: 'Imagen Hero',
      relationTo: 'archivos',
      required: true,
    },

    // Sección de Bienvenida
    {
      name: 'welcomeTitle',
      type: 'text',
      label: 'Título de Bienvenida',
      localized: true,
      admin: {
        description: 'Título de la sección de bienvenida (Historia)',
      },
    },
    {
      name: 'welcomeText',
      type: 'richText',
      label: 'Texto de Bienvenida / Fundación',
      localized: true,
      admin: {
        description: 'Historia y filosofía del restaurante',
      },
    },

    // Galería de Bienvenida
    {
      name: 'galeriaInicio',
      type: 'array',
      label: 'Galería de Imágenes Inicio',
      fields: [
        {
          name: 'imagen',
          type: 'upload',
          relationTo: 'archivos',
          required: true,
        },
      ],
      admin: {
        description: 'Galería de imágenes para la página de inicio',
      },
    },

    // CTA (Call to Action)
    {
      name: 'ctaTitle',
      type: 'text',
      label: 'Título del CTA de Reservas',
      localized: true,
      admin: {
        description: 'Texto del call to action para reservar',
      },
    },
    {
      name: 'ctaText',
      type: 'textarea',
      label: 'Texto del CTA',
      localized: true,
    },
    {
      name: 'ctaButtonText',
      type: 'text',
      label: 'Texto del Botón CTA',
      localized: true,
      defaultValue: 'Reservar ahora',
      admin: {
        description: 'Texto del botón de reserva',
      },
    },

    // Galería Regala Gastronomía (fondo)
    {
      name: 'galeriaRegalo',
      type: 'array',
      label: 'Galería Sección Regalo (Fondo)',
      minRows: 4,
      maxRows: 4,
      fields: [
        {
          name: 'imagen',
          type: 'upload',
          relationTo: 'archivos',
          required: true,
        },
      ],
      admin: {
        description: 'Selecciona 4 imágenes para el fondo de la sección "Regala Gastronomía"',
      },
    },

    // Espacios destacados
    {
      name: 'espaciosDestacados',
      type: 'relationship',
      label: 'Espacios Destacados en Home',
      relationTo: 'espacios',
      hasMany: true,
      maxRows: 5,
      admin: {
        description: 'Selecciona los espacios a mostrar en el home',
      },
    },
    // Experiencias destacadas
    {
      name: 'experienciasDestacadas',
      type: 'relationship',
      label: 'Experiencias Destacadas en Home',
      relationTo: 'experiencias',
      hasMany: true,
      maxRows: 3,
      admin: {
        description: 'Selecciona las experiencias a mostrar en el home',
      },
    },

    // SEO
    {
      name: 'seoTitle',
      type: 'text',
      label: 'SEO: Título',
      localized: true,
      maxLength: 60,
      admin: {
        description: 'Título para SEO (meta title)',
      },
    },
    {
      name: 'seoDescription',
      type: 'textarea',
      label: 'SEO: Descripción',
      localized: true,
      maxLength: 160,
      admin: {
        description: 'Descripción para SEO (meta description)',
      },
    },
  ],
}

