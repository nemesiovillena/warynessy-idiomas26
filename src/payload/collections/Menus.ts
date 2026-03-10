import type { CollectionConfig } from 'payload'
import { translateDocument, translatingIds } from '../utils/translation-utils'

export const Menus: CollectionConfig = {
  slug: 'menus',
  labels: {
    singular: 'Menú',
    plural: 'Menús',
  },
  admin: {
    useAsTitle: 'nombre',
    defaultColumns: ['nombre', 'precio', 'orden', 'etiqueta', 'activo'],
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
        // y si no es una operación disparada por el propio sistema de traducción
        if (locale && locale !== 'es') {
          return;
        }

        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          const executeTranslations = async () => {
            if (translatingIds.has(doc.id)) {
              console.log(`[MENUS] Traducción ya en curso para ID: ${doc.id}, omitiendo.`);
              return;
            }
            translatingIds.add(doc.id);

            try {
              const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
              const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
              const modelo = configTraduccion?.modeloIA || 'gemini-2.0-flash';
              const proveedor = configTraduccion?.proveedorIA || 'gemini-api';

              const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
              const fieldsToTranslate = ['nombre', 'etiqueta', 'descripcion_menu', 'fechasDias', 'descripcion'];

              console.log(`[MENUS] [Background] Iniciando traducciones para ID: ${doc.id}`);

              for (const locale of targetLocales) {
                const { translatedData, hasTranslations } = await translateDocument({
                  doc,
                  previousDoc,
                  fields: fieldsToTranslate,
                  targetLang: locale,
                  endpoint,
                  model: modelo,
                  proveedor,
                  operation
                });

                if (hasTranslations) {
                  console.log(`[MENUS] [Background] Aplicando traducciones a locale ${locale} para ID: ${doc.id}...`);
                  await req.payload.update({
                    collection: 'menus',
                    id: doc.id,
                    locale: locale as any,
                    data: translatedData,
                    req: { payload: req.payload, disableHooks: true } as any,
                  });
                }
              }
              console.log(`[MENUS] [Background] Traducciones completadas para ID: ${doc.id}.`);
            } catch (error) {
              console.error('[MENUS] [Background] Error en hook de traducción:', error);
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
      label: 'Nombre del Menú',
      required: true,
      localized: true,
      admin: {
        description: 'Ej: Menú del Día, Menú Degustación, Menú San Valentín, etc.',
      },
    },
    {
      name: 'etiqueta',
      type: 'text',
      label: 'Etiqueta (Badge)',
      localized: true,
      admin: {
        description: 'Pequeño texto decorativo (ej: "Popular", "Exclusivo", "Nuevo")',
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
            // Sanitizar siempre: trim + minúsculas + sin espacios internos
            if (typeof value === 'string') return value.trim().toLowerCase().replace(/\s+/g, '-')
            return value
          },
        ],
      },
    },
    {
      name: 'imagen',
      type: 'upload',
      label: 'Imagen Promocional del Menú',
      relationTo: 'archivos',
    },
    {
      name: 'precio',
      type: 'number',
      label: 'Precio (€)',
      required: true,
      min: 0,
    },
    {
      name: 'descripcion_menu',
      type: 'textarea',
      label: 'Información',
      localized: true,
      admin: {
        description: 'Ej: "Este menú se ofrece de miércoles a viernes mediodía. A partir de 2 personas."',
      },
    },
    {
      name: 'fechasDias',
      type: 'text',
      label: 'Etiqueta de disponibilidad',
      localized: true,
      admin: {
        description: 'Texto corto para badge (ej: "Entre semana", "Fines de semana")',
      },
    },
    {
      name: 'fechaInicio',
      type: 'date',
      label: 'Fecha de Inicio',
      admin: {
        description: 'Fecha desde la que está disponible el menú',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'fechaFin',
      type: 'date',
      label: 'Fecha de Fin',
      admin: {
        description: 'Fecha hasta la que está disponible el menú',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'descripcion',
      type: 'richText',
      label: 'Descripción del menú (Composición)',
      localized: true,
      admin: {
        description: 'Escribe aquí la composición completa del menú: entrantes, principales, postres, etc.',
      },
    },
    {
      name: 'pdf',
      type: 'upload',
      label: 'PDF del Menú',
      relationTo: 'archivos',
      admin: {
        description: 'PDF descargable del menú (opcional)',
      },
    },
    {
      name: 'activo',
      type: 'checkbox',
      label: '¿Visible en la Web?',
      defaultValue: true,
      admin: {
        description: 'Activa o desactiva la visibilidad del menú',
      },
    },
    {
      name: 'destacado',
      type: 'checkbox',
      label: '¿Menú Destacado?',
      defaultValue: false,
      admin: {
        description: 'Marca para mostrar en posición destacada',
      },
    },
    {
      name: 'orden',
      type: 'number',
      label: 'Orden de Aparición',
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'diasSemana',
      type: 'select',
      label: 'Días de la Semana Disponibles',
      hasMany: true,
      options: [
        { label: 'Lunes', value: 'lunes' },
        { label: 'Martes', value: 'martes' },
        { label: 'Miércoles', value: 'miercoles' },
        { label: 'Jueves', value: 'jueves' },
        { label: 'Viernes', value: 'viernes' },
        { label: 'Sábado', value: 'sabado' },
        { label: 'Domingo', value: 'domingo' },
      ],
      admin: {
        description: 'Selecciona los días en que está disponible',
      },
    },
    {
      name: 'horario',
      type: 'select',
      label: 'Horario',
      options: [
        { label: 'Solo Comidas', value: 'comidas' },
        { label: 'Solo Cenas', value: 'cenas' },
        { label: 'Comidas y Cenas', value: 'ambos' },
      ],
    },
  ],
  defaultSort: 'orden',
}
