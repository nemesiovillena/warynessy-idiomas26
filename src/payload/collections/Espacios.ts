import type { CollectionConfig } from 'payload'
import { callTranslationAgent, translateLexical, translateDocument } from '../utils/translation-utils'

export const Espacios: CollectionConfig = {
  slug: 'espacios',
  labels: {
    singular: 'Espacio',
    plural: 'Espacios',
  },
  admin: {
    useAsTitle: 'nombre',
    defaultColumns: ['nombre', 'capacidad', 'activo'],
    group: 'Contenido',
  },
  access: {
    read: () => true, // Public read access
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const locale = (req as any).locale;

        // PROTECCIÓN CRÍTICA: Solo traducir si estamos editando explícitamente en español
        if (locale !== 'es') {
          return;
        }

        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          const executeTranslations = async () => {
            // Esperar un momento para asegurar que la transacción original se complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
              const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
              const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
              const modelo = configTraduccion?.modeloIA || 'google/gemini-2.0-flash-001';

              const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
              // Campos a traducir, incluyendo el RichText 'descripcion' y el array 'caracteristicas'
              const fieldsToTranslate = ['nombre', 'descripcion', 'caracteristicas'];

              for (const locale of targetLocales) {
                const { translatedData, hasTranslations } = await translateDocument({
                  doc,
                  previousDoc,
                  fields: fieldsToTranslate,
                  targetLang: locale,
                  endpoint,
                  model: modelo,
                  operation
                });

                if (hasTranslations) {
                  console.log(`[ESPACIOS] [Background] Aplicando traducciones a locale ${locale}...`);
                  await req.payload.update({
                    collection: 'espacios',
                    id: doc.id,
                    locale: locale as any,
                    data: translatedData,
                    req: { payload: req.payload, disableHooks: true } as any,
                  });
                }
              }
              console.log(`[ESPACIOS] [Background] Traducciones completadas.`);
            } catch (error) {
              console.error('[ESPACIOS] [Background] Error en hook de traducción:', error);
            }
          };

          executeTranslations();
        }

      }
    ]
  },
  fields: [
    {
      name: 'nombre',
      type: 'text',
      label: 'Nombre del Espacio',
      required: true,
      localized: true,
      admin: {
        description: 'Ej: Salón Principal, Zona Bar, Terraza, Sala Privada, etc.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.nombre) {
              return data.nombre
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'descripcion',
      type: 'richText',
      label: 'Descripción del Espacio',
      localized: true,
      admin: {
        description: 'Descripción detallada del espacio',
      },
    },
    {
      name: 'galeria',
      type: 'array',
      label: 'Galería de Imágenes',
      fields: [
        {
          name: 'imagen',
          type: 'upload',
          relationTo: 'archivos',
          required: true,
        },
      ],
      admin: {
        description: 'Múltiples imágenes del espacio',
      },
    },
    {
      name: 'capacidad',
      type: 'number',
      label: 'Capacidad',
      admin: {
        description: 'Número de personas que puede albergar',
      },
    },
    {
      name: 'caracteristicas',
      type: 'array',
      label: 'Características',
      fields: [
        {
          name: 'caracteristica',
          type: 'text',
          required: true,
          localized: true,
        },
      ],
      admin: {
        description: 'Ej: "Aire acondicionado", "Vista panorámica", "WiFi", etc.',
      },
    },
    {
      name: 'orden',
      type: 'number',
      label: 'Orden de Aparición',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'activo',
      type: 'checkbox',
      label: '¿Visible en la Web?',
      defaultValue: true,
    },
    {
      name: 'disponibleEventos',
      type: 'checkbox',
      label: '¿Disponible para Eventos Privados?',
      defaultValue: false,
      admin: {
        description: 'Marca si este espacio se puede reservar para eventos',
      },
    },
  ],
  defaultSort: 'orden',
}
