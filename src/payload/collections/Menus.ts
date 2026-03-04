import type { CollectionConfig } from 'payload'
import { callTranslationAgent, translateLexical } from '../utils/translation-utils'

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
        if (operation === 'create' || operation === 'update') {
          const payload = req.payload;
          try {
            // Evitar bucles: solo traducir si el locale de la petición es 'es'
            if ((req as any).locale !== 'es') return;

            console.log(`[MENUS] Iniciando traducción automática para: ${doc.nombre}`);

            const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
            const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
            const modelo = configTraduccion?.modeloIA || 'google/gemini-2.0-flash-001';

            const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
            const fieldsToTranslate = ['nombre', 'etiqueta', 'descripcion_menu', 'fechasDias', 'descripcion'];

            await Promise.all(targetLocales.map(async (locale) => {
              const translatedData: any = {};
              let hasTranslations = false;

              await Promise.all(fieldsToTranslate.map(async (field) => {
                const value = doc[field];
                if (!value) return;
                const prevValue = previousDoc?.[field];
                const changed = operation === 'create' || JSON.stringify(value) !== JSON.stringify(prevValue);
                if (!changed) return;
                if (typeof value === 'object' && value !== null && value.root) {
                  translatedData[field] = await translateLexical(value, locale, endpoint, modelo);
                  hasTranslations = true;
                } else if (typeof value === 'string' && value.trim().length > 0) {
                  translatedData[field] = await callTranslationAgent(value, locale, endpoint, modelo);
                  hasTranslations = true;
                }
              }));

              if (hasTranslations) {
                console.log(`[MENUS] Aplicando traducciones a locale ${locale}...`);
                await (payload as any).update({
                  collection: 'menus',
                  id: doc.id,
                  locale: locale as any,
                  data: translatedData,
                  req: { ...req, disableHooks: true } as any,
                });
              }
            }));
          } catch (error) {
            console.error('[MENUS] Error en hook de traducción:', error);
          }
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
