import type { CollectionConfig } from 'payload'
import { callTranslationAgent } from '../utils/translation-utils'

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
        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          try {
            if ((req as any).locale !== 'es') return;

            console.log(`[CATEGORIAS] Iniciando traducción automática para: ${doc.nombre}`);

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
                  console.log(`[CATEGORIAS] Traduciendo ${field} al locale ${locale}...`);
                  translatedData[field] = await callTranslationAgent(value, locale, endpoint, modelo);
                  hasTranslations = true;
                }
              }));

              if (hasTranslations) {
                console.log(`[CATEGORIAS] Aplicando traducciones a locale ${locale}...`);
                await (payload as any).update({
                  collection: 'categorias',
                  id: doc.id,
                  locale: locale as any,
                  data: translatedData,
                  req: { ...req, disableHooks: true } as any,
                });
              }
            }));
          } catch (error) {
            console.error('[CATEGORIAS] Error en hook de traducción:', error);
          }
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
