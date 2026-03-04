import type { CollectionConfig } from 'payload'
import { translateDocument } from '../utils/translation-utils'

export const Experiencias: CollectionConfig = {
    slug: 'experiencias',
    labels: {
        singular: 'Experiencia',
        plural: 'Experiencias',
    },
    admin: {
        useAsTitle: 'titulo',
        defaultColumns: ['titulo', 'precio', 'activo'],
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
                            const fieldsToTranslate = ['titulo', 'descripcion', 'resumen', 'incluye', 'validez']

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
                                    console.log(`[EXPERIENCIAS] [Background] Aplicando traducciones a locale ${locale}...`)
                                    await req.payload.update({
                                        collection: 'experiencias',
                                        id: doc.id,
                                        locale: locale as any,
                                        data: translatedData,
                                        req: { payload: req.payload, disableHooks: true } as any,
                                    })
                                }
                            }
                            console.log(`[EXPERIENCIAS] [Background] Traducciones completadas.`)
                        } catch (error) {
                            console.error('[EXPERIENCIAS] [Background] Error en hook de traducción:', error)
                        }
                    }

                    executeTranslations()
                }

            },
        ],
    },
    fields: [
        {
            name: 'titulo',
            type: 'text',
            label: 'Título de la Experiencia',
            required: true,
            localized: true,
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
                        if (!value && data?.titulo) {
                            return data.titulo
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
            label: 'Descripción',
            localized: true,
            admin: {
                description: 'Descripción completa de la experiencia',
            },
        },
        {
            name: 'resumen',
            type: 'textarea',
            label: 'Resumen Corto',
            maxLength: 150,
            localized: true,
            admin: {
                description: 'Descripción breve para la tarjeta',
            },
        },
        {
            name: 'precio',
            type: 'number',
            label: 'Precio (€)',
            required: true,
            min: 0,
        },
        {
            name: 'imagen',
            type: 'upload',
            label: 'Imagen Destacada',
            relationTo: 'archivos',
            required: true,
        },
        {
            name: 'linkCompra',
            type: 'text',
            label: 'Link de Compra',
            admin: {
                description: 'URL externa para comprar la experiencia',
            },
        },
        {
            name: 'colorFondo',
            type: 'text',
            label: 'Color de Fondo (Hex)',
            admin: {
                description: 'Color de fondo para la tarjeta (ej: #F5F5DC)',
            },
            validate: (value: any) => {
                if (value && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
                    return 'Debe ser un color hexadecimal válido (ej: #FF5733)'
                }
                return true
            },
        },
        {
            name: 'incluye',
            type: 'array',
            label: '¿Qué Incluye?',
            localized: true,
            fields: [
                {
                    name: 'item',
                    type: 'text',
                    required: true,
                    localized: true,
                },
            ],
            admin: {
                description: 'Lista de cosas que incluye la experiencia',
            },
        },
        {
            name: 'validez',
            type: 'text',
            label: 'Validez',
            localized: true,
            admin: {
                description: 'Ej: "Válido durante 1 año desde la compra"',
            },
        },
        {
            name: 'activo',
            type: 'checkbox',
            label: '¿Visible en la Web?',
            defaultValue: true,
        },
        {
            name: 'destacado',
            type: 'checkbox',
            label: '¿Destacado?',
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
    ],
    defaultSort: 'orden',
}
