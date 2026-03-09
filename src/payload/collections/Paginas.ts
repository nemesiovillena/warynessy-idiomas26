import type { CollectionConfig } from 'payload'
import { callTranslationAgent, translateLexical, translateDocument } from '../utils/translation-utils'

export const Paginas: CollectionConfig = {
    slug: 'paginas',
    labels: {
        singular: 'Página',
        plural: 'Páginas',
    },
    admin: {
        useAsTitle: 'tituloInterno',
        defaultColumns: ['tituloInterno', 'slug', 'updatedAt'],
        group: 'Contenido',
    },
    access: {
        read: () => true,
        create: () => true,
        update: () => true,
        delete: () => true,
    },
    hooks: {
        afterChange: [
            async ({ doc, previousDoc, operation, req }) => {
                const _locale = (req as any).locale || 'es';
                console.log(`[PAGINAS] afterChange hook ejecutado. Operación: ${operation}, Locale: ${_locale}, ID: ${doc.id}`);
                if (_locale !== 'es') return;
                if (operation === 'create' || operation === 'update') {
                    const payload = req.payload;
                    const executeTranslations = async () => {
                        // Esperar un momento aleatorio para evitar colisiones
                        const randomDelay = Math.floor(Math.random() * 2000);
                        await new Promise(resolve => setTimeout(resolve, 1000 + randomDelay));

                        try {
                            const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
                            const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
                            const modelo = configTraduccion?.modeloIA || 'google/gemini-2.0-flash-001';

                            const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
                            const fieldsToTranslate = ['heroTitle', 'heroSubtitle', 'historiaMision', 'historiaHitos', 'nombreEspacio1', 'descripcionEspacio1', 'nombreEspacio2', 'descripcionEspacio2', 'nombreEspacio3', 'descripcionEspacio3', 'nombreEspacio4', 'descripcionEspacio4', 'metaTitle', 'metaDescription'];

                            console.log(`[PAGINAS] [Background] Iniciando traducciones para ID: ${doc.id}`);

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

                                // Limpiar campos del sistema que no deben actualizarse
                                const { id: _id, updatedAt: _ua, createdAt: _ca, ...cleanTranslatedData } = translatedData as any;

                                if (hasTranslations) {
                                    console.log(`[PAGINAS] [Background] Aplicando traducciones a locale ${locale} para ID: ${doc.id}...`);
                                    console.log(`[PAGINAS] [DEBUG] Data para ${locale}: ${JSON.stringify(cleanTranslatedData).substring(0, 500)}...`);
                                    await req.payload.update({
                                        collection: 'paginas',
                                        id: doc.id,
                                        locale: locale as any,
                                        data: cleanTranslatedData,
                                        req: { payload: req.payload, disableHooks: true } as any,
                                    });
                                } else {
                                    console.log(`[PAGINAS] [Background] No se obtuvieron traducciones reales para locale ${locale} (ID: ${doc.id}).`);
                                }
                            }
                            console.log(`[PAGINAS] [Background] Traducciones completadas para ID: ${doc.id}.`);
                        } catch (error) {
                            console.error('[PAGINAS] [Background] Error en hook de traducción:', error);
                        }
                    };

                    executeTranslations();
                }
            }

        ]
    },
    fields: [
        {
            name: 'tituloInterno',
            type: 'text',
            label: 'Nombre Interno (Admin)',
            required: true,
            admin: {
                description: 'Ej: Página de Inicio, Nosotros, etc.',
            },
        },
        {
            name: 'slug',
            type: 'text',
            label: 'Slug (URL)',
            required: true,
            unique: true,
            admin: {
                description: 'Identificador único (historia, carta, contacto...)',
            },
        },
        {
            type: 'tabs',
            tabs: [
                {
                    label: 'Cabecera (Hero)',
                    fields: [
                        {
                            name: 'heroImage',
                            type: 'upload',
                            label: 'Imagen Hero',
                            relationTo: 'archivos',
                            required: true,
                        },
                        {
                            name: 'heroTitle',
                            type: 'text',
                            label: 'Título de la Cabecera',
                            localized: true,
                        },
                        {
                            name: 'heroSubtitle',
                            type: 'textarea',
                            label: 'Subtítulo de la Cabecera',
                            localized: true,
                        },
                    ],
                },
                {
                    label: 'Layout Espacios',
                    admin: {
                        condition: (data) => data?.slug === 'espacios',
                    },
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'imagenEspacio1',
                                    type: 'upload',
                                    label: 'Imagen 1 (Superior izquierda)',
                                    relationTo: 'archivos',
                                    admin: {
                                        width: '50%',
                                    },
                                },
                                {
                                    name: 'nombreEspacio1',
                                    type: 'text',
                                    label: 'Nombre Espacio 1',
                                    localized: true,
                                    admin: {
                                        width: '50%',
                                    },
                                },
                            ],
                        },
                        {
                            name: 'descripcionEspacio1',
                            type: 'textarea',
                            label: 'Descripción Espacio 1',
                            localized: true,
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'imagenEspacio2',
                                    type: 'upload',
                                    label: 'Imagen 2 (Superior derecha)',
                                    relationTo: 'archivos',
                                    admin: {
                                        width: '50%',
                                    },
                                },
                                {
                                    name: 'nombreEspacio2',
                                    type: 'text',
                                    label: 'Nombre Espacio 2',
                                    localized: true,
                                    admin: {
                                        width: '50%',
                                    },
                                },
                            ],
                        },
                        {
                            name: 'descripcionEspacio2',
                            type: 'textarea',
                            label: 'Descripción Espacio 2',
                            localized: true,
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'imagenEspacio3',
                                    type: 'upload',
                                    label: 'Imagen 3 (Inferior izquierda)',
                                    relationTo: 'archivos',
                                    admin: {
                                        width: '50%',
                                    },
                                },
                                {
                                    name: 'nombreEspacio3',
                                    type: 'text',
                                    label: 'Nombre Espacio 3',
                                    localized: true,
                                    admin: {
                                        width: '50%',
                                    },
                                },
                            ],
                        },
                        {
                            name: 'descripcionEspacio3',
                            type: 'textarea',
                            label: 'Descripción Espacio 3',
                            localized: true,
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'imagenEspacio4',
                                    type: 'upload',
                                    label: 'Imagen 4 (Inferior derecha)',
                                    relationTo: 'archivos',
                                    admin: {
                                        width: '50%',
                                    },
                                },
                                {
                                    name: 'nombreEspacio4',
                                    type: 'text',
                                    label: 'Nombre Espacio 4',
                                    localized: true,
                                    admin: {
                                        width: '50%',
                                    },
                                },
                            ],
                        },
                        {
                            name: 'descripcionEspacio4',
                            type: 'textarea',
                            label: 'Descripción Espacio 4',
                            localized: true,
                        },
                    ],
                },
                {
                    label: 'Layout Historia',
                    admin: {
                        condition: (data, siblingData) => {
                            const slug = data?.slug || siblingData?.slug;
                            return slug?.toLowerCase() === 'historia';
                        },
                    },
                    fields: [
                        {
                            name: 'historiaMision',
                            type: 'textarea',
                            label: 'Nuestra Misión / Introducción',
                            localized: true,
                        },
                        {
                            name: 'historiaHitos',
                            type: 'array',
                            label: 'Hitos Históricos',
                            localized: true,
                            fields: [
                                {
                                    name: 'titulo',
                                    type: 'text',
                                    label: 'Título del Hito (ej: Los Inicios)',
                                    localized: true,
                                },
                                {
                                    name: 'descripcion',
                                    type: 'textarea',
                                    label: 'Descripción del Hito',
                                    localized: true,
                                },
                                {
                                    name: 'imagen',
                                    type: 'upload',
                                    relationTo: 'archivos',
                                    label: 'Imagen Asociada (Opcional)',
                                },
                            ]
                        }
                    ]
                },
                {
                    label: 'SEO y Metadatos',
                    fields: [
                        {
                            name: 'metaTitle',
                            type: 'text',
                            label: 'Título SEO (Meta Title)',
                            localized: true,
                            admin: {
                                description: 'Aparece en la pestaña del navegador y Google',
                            },
                        },
                        {
                            name: 'metaDescription',
                            type: 'textarea',
                            label: 'Descripción SEO (Meta Description)',
                            localized: true,
                            admin: {
                                description: 'Breve resumen para los resultados de búsqueda',
                            },
                        },
                    ],
                },
            ],
        },
    ],
}
