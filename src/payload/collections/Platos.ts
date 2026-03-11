import type { CollectionConfig } from 'payload'
import { translatingIds, translateDocument } from '../utils/translation-utils'

export const Platos: CollectionConfig = {
  slug: 'platos',
  labels: {
    singular: 'Plato',
    plural: 'Platos',
  },
  admin: {
    useAsTitle: 'nombre',
    defaultColumns: ['nombre', 'categoria', 'precio', 'activo'],
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
              console.log(`[PLATOS] Traducción ya en curso para ID: ${doc.id}, omitiendo.`);
              return;
            }
            translatingIds.add(doc.id);

            try {
              const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
              const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
              const modelo = configTraduccion?.modeloIA || 'anthropic/claude-3-5-haiku';

              const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
              const fieldsToTranslate = ['nombre', 'descripcion'];

              console.log(`[PLATOS] [Background] Iniciando traducciones para ID: ${doc.id}`);

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
                  console.log(`[PLATOS] [Background] Aplicando traducciones a locale ${locale} para ID: ${doc.id}...`);
                  await req.payload.update({
                    collection: 'platos',
                    id: doc.id,
                    locale: locale as any,
                    data: translatedData,
                    req: { payload: req.payload, disableHooks: true } as any,
                  })
                }
              }
              console.log(`[PLATOS] [Background] Traducciones completadas para ID: ${doc.id}.`);
            } catch (error) {
              console.error('[PLATOS] [Background] Error en hook de traducción:', error);
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
      label: 'Nombre del Plato',
      required: true,
      localized: true,
    },
    {
      name: 'descripcion',
      type: 'textarea',
      label: 'Descripción / Ingredientes',
      localized: true,
      admin: {
        description: 'Descripción del plato e ingredientes principales',
      },
    },
    {
      name: 'precio',
      type: 'text',
      label: 'Precio',
      required: true,
      admin: {
        description: 'Ej: "12,50 €", "60€ Kg.", "Consultar"',
      },
    },
    {
      name: 'imagen',
      type: 'upload',
      label: 'Imagen del Plato',
      relationTo: 'archivos',
    },
    {
      name: 'categoria',
      type: 'relationship',
      label: 'Categoría',
      relationTo: 'categorias',
      required: true,
      hasMany: false,
    },
    {
      name: 'alergenos',
      type: 'relationship',
      label: 'Alérgenos',
      relationTo: 'alergenos',
      hasMany: true,
      admin: {
        description: 'Selecciona todos los alérgenos que contiene el plato',
      },
    },
    {
      name: 'activo',
      type: 'checkbox',
      label: '¿Disponible?',
      defaultValue: true,
      admin: {
        description: 'Desactiva cuando el plato esté agotado o no disponible',
      },
    },
    {
      name: 'destacado',
      type: 'checkbox',
      label: '¿Plato Destacado?',
      defaultValue: false,
      admin: {
        description: 'Marca como plato destacado o recomendado',
      },
    },
    {
      name: 'orden',
      type: 'number',
      label: 'Orden dentro de la Categoría',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Orden de aparición dentro de su categoría',
      },
    },
    {
      name: 'etiquetas',
      type: 'array',
      label: 'Etiquetas',
      fields: [
        {
          name: 'etiqueta',
          type: 'text',
          required: true,
          localized: true,
        },
      ],
      admin: {
        description: 'Ej: "Vegano", "Picante", "Recomendado del Chef", etc.',
      },
    },
  ],
  defaultSort: 'orden',
}
