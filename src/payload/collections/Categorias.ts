import type { CollectionConfig } from 'payload'
import { translatingIds, translateDocument } from '../utils/translation-utils'

export const Categorias: CollectionConfig = {
  slug: 'categorias',
  labels: {
    singular: 'Categoría',
    plural: 'Categorías',
  },
  admin: {
    useAsTitle: 'nombre',
    defaultColumns: ['nombre', 'orden', 'activa'],
    group: 'Carta',
  },
  access: {
    read: () => true, // Public read access
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const locale = (req as any).locale;

        // PROTECCIÓN CRÍTICA: Solo traducir si estamos editando explícitamente en español
        if (locale && locale !== 'es') {
          return;
        }

        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          const executeTranslations = async () => {
            if (translatingIds.has(doc.id)) {
              console.log(`[CATEGORIAS] Traducción ya en curso para ID: ${doc.id}, omitiendo.`);
              return;
            }
            translatingIds.add(doc.id);

            try {
              const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
              const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
              const modelo = configTraduccion?.modeloIA || 'anthropic/claude-3-5-haiku';

              const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
              const fieldsToTranslate = ['nombre', 'descripcion'];

              console.log(`[CATEGORIAS] [Background] Iniciando traducciones para ID: ${doc.id}`);

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
                  console.log(`[CATEGORIAS] [Background] Aplicando traducciones a locale ${locale} para ID: ${doc.id}...`);
                  await req.payload.update({
                    collection: 'categorias',
                    id: doc.id,
                    locale: locale as any,
                    data: translatedData,
                    req: { payload: req.payload, disableHooks: true } as any,
                  });
                }
              }
              console.log(`[CATEGORIAS] [Background] Traducciones completadas para ID: ${doc.id}.`);
            } catch (error) {
              console.error('[CATEGORIAS] [Background] Error en hook de traducción:', error);
            } finally {
              translatingIds.delete(doc.id);
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
      label: 'Nombre de la Categoría',
      required: true,
      localized: true,
      admin: {
        description: 'Ej: Entrantes, Carnes, Pescados, Postres, etc.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      admin: {
        description: 'URL amigable para la categoría',
      },
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
      type: 'textarea',
      label: 'Descripción',
      localized: true,
      admin: {
        description: 'Descripción opcional de la categoría',
      },
    },
    {
      name: 'orden',
      type: 'number',
      label: 'Orden de Aparición',
      required: true,
      min: 0,
      defaultValue: 1,
      admin: {
        description: 'Orden en el que aparece en el menú (1, 2, 3...)',
      },
    },
    {
      name: 'activa',
      type: 'checkbox',
      label: '¿Categoría Activa?',
      defaultValue: true,
      admin: {
        description: 'Desactiva para ocultar la categoría sin borrarla',
      },
    },
    {
      name: 'imagen',
      type: 'upload',
      label: 'Imagen de la Categoría',
      relationTo: 'archivos',
      admin: {
        description: 'Imagen representativa (opcional)',
      },
    },
  ],
  defaultSort: 'orden',
}
