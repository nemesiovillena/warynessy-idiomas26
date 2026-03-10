import type { GlobalConfig } from 'payload'
import { callTranslationAgent, translateLexical, translateDocument } from '../utils/translation-utils'

export const PaginaInicio: GlobalConfig = {
  slug: 'pagina-inicio',
  label: 'Página de Inicio',
  access: {
    read: () => true, // Public read access
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const locale = (req as any).locale;

        // PROTECCIÓN CRÍTICA: Solo traducir si estamos editando explícitamente en español
        if (locale && locale !== 'es') {
          return;
        }

        const payload = req.payload;
        const executeTranslations = async () => {
          // Esperar un momento aleatorio para evitar colisiones
          const randomDelay = Math.floor(Math.random() * 2000);
          await new Promise(resolve => setTimeout(resolve, 1000 + randomDelay));

          try {
            const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
            const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
            const modelo = configTraduccion?.modeloIA || 'gemini-2.0-flash';
              const proveedor = configTraduccion?.proveedorIA || 'gemini-api';

            const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
            const fieldsToTranslate = [
              'heroTitle', 'heroSubtitle', 'welcomeTitle', 'welcomeText',
              'ctaTitle', 'ctaText', 'ctaButtonText', 'seoTitle', 'seoDescription'
            ];

            console.log(`[PAGINA-INICIO] [Background] Iniciando proceso de traducción para Global...`);

            for (const targetLocale of targetLocales) {
              const { translatedData, hasTranslations } = await translateDocument({
                doc,
                previousDoc,
                fields: fieldsToTranslate,
                targetLang: targetLocale,
                endpoint,
                model: modelo,
                  proveedor,
                operation: 'update'
              });

              if (hasTranslations) {
                console.log(`[PAGINA-INICIO] [Background] Aplicando traducciones a locale ${targetLocale}...`);
                await req.payload.updateGlobal({
                  slug: 'pagina-inicio',
                  locale: targetLocale as any,
                  data: translatedData,
                  req: { payload: req.payload, disableHooks: true } as any,
                });
              }
            }
            console.log(`[PAGINA-INICIO] [Background] Traducciones completadas.`);
          } catch (error) {
            console.error('[PAGINA-INICIO] [Background] Error en hook de traducción:', error);
          }
        };

        executeTranslations();
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

