import type { CollectionConfig } from 'payload'

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
                        },
                        {
                            name: 'heroSubtitle',
                            type: 'textarea',
                            label: 'Subtítulo de la Cabecera',
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
                                },
                                {
                                    name: 'descripcion',
                                    type: 'textarea',
                                    label: 'Descripción del Hito',
                                    required: true,
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
                            admin: {
                                description: 'Aparece en la pestaña del navegador y Google',
                            },
                        },
                        {
                            name: 'metaDescription',
                            type: 'textarea',
                            label: 'Descripción SEO (Meta Description)',
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
