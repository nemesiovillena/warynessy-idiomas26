import type { CollectionConfig } from 'payload'
import { callTranslationAgent } from '../utils/translation-utils'

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
        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          try {
            // Evitar bucles: solo traducir si el locale de la petición es 'es'
            if ((req as any).locale !== 'es') return;

            console.log(`[PLATOS] Iniciando traducción automática para: ${doc.nombre}`);

            const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
            const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
            const modelo = configTraduccion?.modeloIA || 'google/gemini-2.0-flash-001';

            const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
            const fieldsToTranslate = ['nombre', 'descripcion'];

            await Promise.all(targetLocales.map(async (locale) => {
              const translatedData: any = {};
              let hasTranslations = false;

              await Promise.all(fieldsToTranslate.map(async (field) => {
                const value = doc[field];
                const prevValue = previousDoc?.[field];
                const changed = operation === 'create' || value !== prevValue;
                if (changed && value && typeof value === 'string' && value.trim().length > 0) {
                  console.log(`[PLATOS] Traduciendo ${field} al locale ${locale}...`);
                  translatedData[field] = await callTranslationAgent(value, locale, endpoint, modelo);
                  hasTranslations = true;
                }
              }));

              if (hasTranslations) {
                console.log(`[PLATOS] Aplicando traducciones a locale ${locale}...`);
                await (payload as any).update({
                  collection: 'platos',
                  id: doc.id,
                  locale: locale as any,
                  data: translatedData,
                  req: { ...req, disableHooks: true } as any,
                });
              }
            }));
          } catch (error) {
            console.error('[PLATOS] Error en hook de traducción:', error);
          }
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
        },
      ],
      admin: {
        description: 'Ej: "Vegano", "Picante", "Recomendado del Chef", etc.',
      },
    },
  ],
  defaultSort: 'orden',
}
