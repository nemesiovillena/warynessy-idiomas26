import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'
import { translateDocument, callTranslationAgent } from '../../../payload/utils/translation-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TARGET_LOCALES = ['ca', 'en', 'fr', 'de'] as const

/**
 * Configuración de campos a traducir por colección.
 * Debe mantenerse sincronizada con los hooks afterChange de cada colección.
 */
const COLLECTION_FIELDS: Record<string, string[]> = {
    'categorias':   ['nombre', 'descripcion'],
    'menus-grupo':  ['nombre', 'descripcion'],
    'platos':       ['nombre', 'descripcion'],
    'espacios':     ['nombre', 'descripcion', 'caracteristicas'],
    'menus':        ['nombre', 'etiqueta', 'descripcion_menu', 'fechasDias', 'descripcion'],
    'paginas':      ['heroTitle', 'heroSubtitle', 'historiaMision', 'historiaHitos', 'nombreEspacio1', 'descripcionEspacio1', 'nombreEspacio2', 'descripcionEspacio2', 'nombreEspacio3', 'descripcionEspacio3', 'nombreEspacio4', 'descripcionEspacio4', 'metaTitle', 'metaDescription'],
}

const GLOBAL_FIELDS: Record<string, string[]> = {
    'pagina-inicio': ['heroTitle', 'heroSubtitle', 'welcomeTitle', 'welcomeText', 'ctaTitle', 'ctaText', 'ctaButtonText', 'seoTitle', 'seoDescription'],
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const secret = searchParams.get('secret')

        if (secret !== process.env.PAYLOAD_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })

        // Leer configuración de traducción
        const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any })
        const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate'
        const modelo = configTraduccion?.modeloIA || 'gemini-2.0-flash'
        const proveedor = configTraduccion?.proveedorIA || 'gemini-api'

        console.log(`[Bulk-Translation] Iniciando proceso masivo (${proveedor} / ${modelo})...`)

        const results: any = { collections: {}, globals: {} }
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

        // --- Traducir Colecciones ---
        for (const [collection, fields] of Object.entries(COLLECTION_FIELDS)) {
            const { docs } = await payload.find({
                collection: collection as any,
                limit: 1000,
                locale: 'es' as any,
                depth: 0,
            })

            results.collections[collection] = { total: docs.length, success: 0, errors: 0 }
            console.log(`[Bulk-Translation] ${collection}: ${docs.length} docs`)

            for (const doc of docs) {
                try {
                    for (const locale of TARGET_LOCALES) {
                        const { translatedData, hasTranslations } = await translateDocument({
                            doc,
                            fields,
                            targetLang: locale,
                            endpoint,
                            model: modelo,
                            proveedor,
                            operation: 'update',
                        })

                        if (hasTranslations) {
                            await payload.update({
                                collection: collection as any,
                                id: doc.id,
                                locale: locale as any,
                                data: translatedData,
                                req: { payload, disableHooks: true } as any,
                            })
                        }
                    }
                    results.collections[collection].success++
                    console.log(`[Bulk-Translation] ✓ ${collection} ${doc.id}`)
                    await sleep(500) // Pequeña pausa entre docs
                } catch (error) {
                    console.error(`[Bulk-Translation] Error en ${collection} ${doc.id}:`, error)
                    results.collections[collection].errors++
                }
            }
        }

        // --- Traducir Globales ---
        for (const [globalSlug, fields] of Object.entries(GLOBAL_FIELDS)) {
            try {
                const doc: any = await payload.findGlobal({
                    slug: globalSlug as any,
                    locale: 'es' as any,
                })

                for (const locale of TARGET_LOCALES) {
                    const { translatedData, hasTranslations } = await translateDocument({
                        doc,
                        fields,
                        targetLang: locale,
                        endpoint,
                        model: modelo,
                        proveedor,
                        operation: 'update',
                    })

                    if (hasTranslations) {
                        await payload.updateGlobal({
                            slug: globalSlug as any,
                            locale: locale as any,
                            data: translatedData,
                            req: { payload, disableHooks: true } as any,
                        })
                    }
                }
                results.globals[globalSlug] = 'success'
                console.log(`[Bulk-Translation] ✓ global ${globalSlug}`)
            } catch (error) {
                console.error(`[Bulk-Translation] Error en global ${globalSlug}:`, error)
                results.globals[globalSlug] = 'error'
            }
        }

        console.log('[Bulk-Translation] Proceso completo:', JSON.stringify(results))
        return NextResponse.json({
            message: 'Proceso de traducción finalizado con éxito',
            results,
        })

    } catch (error: any) {
        console.error('[Bulk-Translation] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
