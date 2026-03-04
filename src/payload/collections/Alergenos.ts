import type { CollectionConfig } from 'payload'
import { translateDocument } from '../utils/translation-utils'

export const Alergenos: CollectionConfig = {
  slug: 'alergenos',
  labels: {
    singular: 'Alérgeno',
    plural: 'Alérgenos',
  },
  admin: {
    useAsTitle: 'nombre',
    defaultColumns: ['nombre', 'codigo', 'icono'],
    group: 'Carta',
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
              const fieldsToTranslate = ['nombre', 'descripcion']

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
                  await req.payload.update({
                    collection: 'alergenos',
                    id: doc.id,
                    locale: locale as any,
                    data: translatedData,
                    req: { payload: req.payload, disableHooks: true } as any,
                  })
                }
              }
              console.log(`[ALERGENOS] [Background] Traducciones completadas.`)
            } catch (error) {
              console.error('[ALERGENOS] [Background] Error en hook de traducción:', error)
            }
          }

          executeTranslations()
        }
      },
    ],
  },
  access: {
    read: () => true, // Public read access
  },
  fields: [
    {
      name: 'nombre',
      type: 'text',
      label: 'Nombre del Alérgeno',
      required: true,
      localized: true,
      admin: {
        description: 'Ej: Gluten, Lactosa, Frutos secos, etc.',
      },
    },
    {
      name: 'codigo',
      type: 'text',
      label: 'Código',
      required: true,
      maxLength: 3,
      admin: {
        description: 'Código corto del alérgeno (ej: G para Gluten)',
      },
    },
    {
      name: 'descripcion',
      type: 'textarea',
      label: 'Descripción',
      localized: true,
      admin: {
        description: 'Descripción detallada del alérgeno',
      },
    },
    {
      name: 'icono',
      type: 'text',
      label: 'Emoji del Alérgeno',
      admin: {
        description: 'Emoji del alérgeno (ej: 🌾) - Fallback si no hay imagen',
      },
    },
    {
      name: 'imagen',
      type: 'upload',
      relationTo: 'archivos',
      label: 'Icono Gráfico',
      admin: {
        description: 'Imagen del icono del alérgeno (preferiblemente WebP o SVG)',
      },
    },
    {
      name: 'orden',
      type: 'number',
      label: 'Orden de Aparición',
      required: true,
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Número para ordenar los alérgenos',
      },
    },
  ],
  defaultSort: 'nombre',
}
