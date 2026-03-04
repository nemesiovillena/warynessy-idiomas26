import type { CollectionConfig } from 'payload'
import { callTranslationAgent } from '../utils/translation-utils'

export const MenusGrupo: CollectionConfig = {
    slug: 'menus-grupo',
    labels: {
        singular: 'Otro Menú',
        plural: 'Otros Menús',
    },
    admin: {
        useAsTitle: 'nombre',
        defaultColumns: ['nombre', 'orden', 'activo'],
        group: 'Carta',
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
                if (operation === 'create' || operation === 'update') {
                    const payload = req.payload;
                    try {
                        if ((req as any).locale !== 'es') return;

                        console.log(`[MENUS-GRUPO] Iniciando traducción automática para: ${doc.nombre}`);

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
                                    console.log(`[MENUS-GRUPO] Traduciendo ${field} al locale ${locale}...`);
                                    translatedData[field] = await callTranslationAgent(value, locale, endpoint, modelo);
                                    hasTranslations = true;
                                }
                            }));

                            if (hasTranslations) {
                                console.log(`[MENUS-GRUPO] Aplicando traducciones a locale ${locale}...`);
                                await (payload as any).update({
                                    collection: 'menus-grupo',
                                    id: doc.id,
                                    locale: locale as any,
                                    data: translatedData,
                                    req: { ...req, disableHooks: true } as any,
                                });
                            }
                        }));
                    } catch (error) {
                        console.error('[MENUS-GRUPO] Error en hook de traducción:', error);
                    }
                }
            }
        ]
    },
    fields: [
        {
            name: 'nombre',
            type: 'text',
            label: 'Nombre del Grupo de Menús',
            required: true,
            localized: true,
            admin: {
                description: 'Ej: Menús de Empresa, Menús de Celebración, etc.',
            },
        },
        {
            name: 'descripcion',
            type: 'textarea',
            label: 'Descripción del Grupo',
            localized: true,
            admin: {
                description: 'Breve introducción para este conjunto de menús.',
            },
        },
        {
            name: 'imagenPortada',
            type: 'upload',
            label: 'Imagen de Portada',
            relationTo: 'archivos',
            admin: {
                description: 'Imagen que representará a este grupo de menús.',
            },
        },
        {
            name: 'menus',
            type: 'relationship',
            label: 'Menús Incluidos',
            relationTo: 'menus',
            hasMany: true,
            admin: {
                description: 'Selecciona los menús individuales que forman parte de este grupo.',
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
            name: 'activo',
            type: 'checkbox',
            label: '¿Visible en la Web?',
            defaultValue: true,
        },
    ],
    defaultSort: 'orden',
}