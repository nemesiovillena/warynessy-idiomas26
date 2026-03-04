import type { CollectionConfig } from 'payload'
import { callTranslationAgent, translateDocument } from '../utils/translation-utils'

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: 'Banner',
    plural: 'Banners',
  },
  admin: {
    useAsTitle: 'titulo',
    defaultColumns: ['titulo', 'posicion', 'activo', 'fechaInicio', 'fechaFin'],
    group: 'Contenido',
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
          const payload = req.payload
          const executeTranslations = async () => {
            // Esperar un momento para asegurar que la transacción original se complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
              const configTraduccion: any = await payload.findGlobal({
                slug: 'configuracion-traduccion' as any,
              })
              const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate'
              const modelo = configTraduccion?.modeloIA || 'google/gemini-2.0-flash-001'

              const targetLocales = ['ca', 'en', 'fr', 'de'] as const
              const fieldsToTranslate = ['titulo', 'texto'] // Corregido nombres de campos según fields real

              for (const locale of targetLocales) {
                const { translatedData, hasTranslations } = await translateDocument({
                  doc,
                  previousDoc,
                  fields: fieldsToTranslate,
                  targetLang: locale,
                  endpoint,
                  model: modelo,
                  operation,
                })

                if (hasTranslations) {
                  // También traducir el texto del enlace si existe
                  if (doc.link?.texto && doc.link.texto !== previousDoc?.link?.texto) {
                    console.log(`[BANNERS] [Background] Traduciendo texto del enlace al locale ${locale}...`)
                    const translatedLinkText = await callTranslationAgent(doc.link.texto, locale, endpoint, modelo);
                    translatedData.link = {
                      ...doc.link,
                      texto: translatedLinkText
                    };
                  }

                  console.log(`[BANNERS] [Background] Aplicando traducciones a locale ${locale}...`)
                  await req.payload.update({
                    collection: 'banners',
                    id: doc.id,
                    locale: locale as any,
                    data: translatedData,
                    req: { payload: req.payload, disableHooks: true } as any,
                  })
                }
              }
              console.log(`[BANNERS] [Background] Traducciones completadas.`)
            } catch (error) {
              console.error('[BANNERS] [Background] Error en hook de traducción:', error)
            }
          };

          executeTranslations();
        }

      },
    ],
  },
  access: {
    read: () => true, // Public read access
  },
  fields: [
    {
      name: 'titulo',
      type: 'text',
      label: 'Título del Banner',
      required: true,
      localized: true,
    },
    {
      name: 'texto',
      type: 'textarea',
      label: 'Texto del Banner',
      localized: true,
      admin: {
        description: 'Texto descriptivo del anuncio',
      },
    },
    {
      name: 'imagen',
      type: 'upload',
      label: 'Imagen del Banner',
      relationTo: 'archivos',
    },
    {
      name: 'link',
      type: 'group',
      label: 'Enlace (opcional)',
      fields: [
        {
          name: 'url',
          type: 'text',
          label: 'URL',
        },
        {
          name: 'texto',
          type: 'text',
          label: 'Texto del enlace',
          localized: true,
        },
        {
          name: 'externo',
          type: 'checkbox',
          label: '¿Link externo?',
          defaultValue: false,
          admin: {
            description: 'Se abrirá en nueva pestaña',
          },
        },
      ],
    },
    {
      name: 'fechaInicio',
      type: 'date',
      label: 'Fecha de Inicio',
      required: true,
      admin: {
        description: 'Fecha desde la que se muestra el banner',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'fechaFin',
      type: 'date',
      label: 'Fecha de Fin',
      required: true,
      admin: {
        description: 'Fecha hasta la que se muestra el banner',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'posicion',
      type: 'select',
      label: 'Posición en la Web',
      required: true,
      options: [
        { label: 'Home - Superior', value: 'home-top' },
        { label: 'Home - Medio', value: 'home-middle' },
        { label: 'Home - Inferior', value: 'home-bottom' },
        { label: 'Carta - Superior', value: 'carta-top' },
        { label: 'Menús - Superior', value: 'menus-top' },
        { label: 'Global - Banner superior', value: 'global-top' },
      ],
      admin: {
        description: 'Dónde se mostrará el banner',
      },
    },
    {
      name: 'tipo',
      type: 'select',
      label: 'Tipo de Banner',
      options: [
        { label: 'Informativo', value: 'info' },
        { label: 'Promoción', value: 'promo' },
        { label: 'Aviso', value: 'warning' },
        { label: 'Evento', value: 'event' },
      ],
      admin: {
        description: 'Tipo de banner para aplicar estilos',
      },
    },
    {
      name: 'activo',
      type: 'checkbox',
      label: '¿Activo?',
      defaultValue: true,
      admin: {
        description: 'Activa o desactiva el banner manualmente',
      },
    },
    {
      name: 'prioridad',
      type: 'number',
      label: 'Prioridad',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Orden si hay múltiples banners (mayor número = mayor prioridad)',
      },
    },
  ],
  defaultSort: '-prioridad',
}
