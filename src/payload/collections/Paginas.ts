import type { CollectionConfig } from 'payload'
import { callTranslationAgent, translateLexical } from '../utils/translation-utils'

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
                // Solo si el usuario ha solicitado traducción y no es una petición interna
                if ((operation === 'create' || operation === 'update')) {
                    const payload = req.payload;
                    try {
                        // Evitar bucles: solo traducir si el locale de la petición es 'es'
                        if ((req as any).locale !== 'es') return;

                        console.log(`[PAGINAS] Iniciando traducción automática para: ${doc.tituloInterno}`);

                        const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
                        const endpoint = configTraduccion.endpointAgente || 'http://localhost:8000/translate';
                        const modelo = configTraduccion.modeloIA;

                        const targetLocales = ['ca', 'en', 'fr', 'de'] as const;
                        const fieldsToTranslate = ['heroTitle', 'heroSubtitle', 'historiaMision', 'metaTitle', 'metaDescription'];

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
                                    console.log(`[PAGINAS] Traduciendo RichText: ${field} al locale ${locale}...`);
                                    translatedData[field] = await translateLexical(value, locale, endpoint, modelo);
                                    hasTranslations = true;
                                }
                                // Si es texto plano
                                else if (typeof value === 'string' && value.trim().length > 0) {
                                    console.log(`[PAGINAS] Traduciendo texto: ${field} al locale ${locale}...`);
                                    translatedData[field] = await callTranslationAgent(value, locale, endpoint, modelo);
                                    hasTranslations = true;
                                }
                            }));

                            if (hasTranslations) {
                                console.log(`[PAGINAS] Aplicando traducciones a locale ${locale}...`);
                                await (payload as any).update({
                                    collection: 'paginas',
                                    id: doc.id,
                                    locale: locale as any,
                                    data: translatedData,
                                    req: { ...req, disableHooks: true } as any,
                                });
                            }
                        }));
                    } catch (error) {
                        console.error('[PAGINAS] Error en hook de traducción:', error);
                    }
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
                                    name: 'imagenEspacio2',
                                    type: 'upload',
                                    label: 'Imagen 2 (Superior derecha)',
                                    relationTo: 'archivos',
                                    admin: {
                                        width: '50%',
                                    },
                                },
                            ],
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
                                    name: 'imagenEspacio4',
                                    type: 'upload',
                                    label: 'Imagen 4 (Inferior derecha)',
                                    relationTo: 'archivos',
                                    admin: {
                                        width: '50%',
                                    },
                                },
                            ],
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
                            fields: [
                                {
                                    name: 'titulo',
                                    type: 'text',
                                    label: 'Título del Hito (ej: Los Inicios)',
                                    required: true,
                                    localized: true,
                                },
                                {
                                    name: 'descripcion',
                                    type: 'textarea',
                                    label: 'Descripción del Hito',
                                    required: true,
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
