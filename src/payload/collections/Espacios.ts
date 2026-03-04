import type { CollectionConfig } from 'payload'
import { callTranslationAgent, translateLexical } from '../utils/translation-utils'

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
        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          try {
            // Evitar bucles: solo traducir si el locale de la petición es 'es'
            if ((req as any).locale !== 'es') return;

            console.log(`[ESPACIOS] Iniciando traducción automática para: ${doc.nombre}`);

            const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
            const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
            const modelo = configTraduccion?.modeloIA || 'google/gemini-2.0-flash-001';

            const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
            // Campos a traducir, incluyendo el RichText 'descripcion'
            const fieldsToTranslate = ['nombre', 'descripcion'];

            await Promise.all(targetLocales.map(async (locale) => {
              const translatedData: any = {};
              let hasTranslations = false;

              await Promise.all(fieldsToTranslate.map(async (field) => {
                const value = doc[field];
                if (!value) return;
                const prevValue = previousDoc?.[field];
                const changed = operation === 'create' || JSON.stringify(value) !== JSON.stringify(prevValue);
                if (!changed) return;

                // Si es RichText (Lexical)
                if (typeof value === 'object' && value !== null && value.root) {
                  console.log(`[ESPACIOS] Traduciendo RichText: ${field} al locale ${locale}...`);
                  translatedData[field] = await translateLexical(value, locale, endpoint, modelo);
                  hasTranslations = true;
                }
                // Si es texto plano
                else if (typeof value === 'string' && value.trim().length > 0) {
                  console.log(`[ESPACIOS] Traduciendo texto: ${field} al locale ${locale}...`);
                  translatedData[field] = await callTranslationAgent(value, locale, endpoint, modelo);
                  hasTranslations = true;
                }
              }));

              if (hasTranslations) {
                console.log(`[ESPACIOS] Aplicando traducciones a locale ${locale}...`);
                await (payload as any).update({
                  collection: 'espacios',
                  id: doc.id,
                  locale: locale as any,
                  data: translatedData,
                  req: { ...req, disableHooks: true } as any,
                });
              }
            }));
          } catch (error) {
            console.error('[ESPACIOS] Error en hook de traducción:', error);
          }
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
