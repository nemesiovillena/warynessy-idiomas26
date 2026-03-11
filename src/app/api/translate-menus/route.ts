import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'
import { translateDocument } from '../../../payload/utils/translation-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TARGET_LOCALES = ['ca', 'en', 'fr', 'de'] as const

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

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        const results: Record<string, any> = {}

        // --- Menus ---
        const { docs: menus } = await payload.find({
            collection: 'menus',
            limit: 1000,
            locale: 'es' as any,
            depth: 0,
        })

        results.menus = { total: menus.length, success: 0, errors: 0 }
        console.log(`[Translate-Menus] Traduciendo ${menus.length} menús (${proveedor} / ${modelo})...`)

        for (const doc of menus) {
            try {
                for (const locale of TARGET_LOCALES) {
                    const { translatedData, hasTranslations } = await translateDocument({
                        doc,
                        fields: ['nombre', 'etiqueta', 'descripcion_menu', 'fechasDias', 'descripcion'],
                        targetLang: locale,
                        endpoint,
                        model: modelo,
                        operation: 'update',
                    })

                    if (hasTranslations) {
                        await payload.update({
                            collection: 'menus',
                            id: doc.id,
                            locale: locale as any,
                            data: translatedData,
                            req: { payload, disableHooks: true } as any,
                        })
                    }
                }
                results.menus.success++
                console.log(`[Translate-Menus] ✓ menú ${doc.id} (${doc.nombre})`)
                await sleep(1000)
            } catch (error) {
                console.error(`[Translate-Menus] Error menú ${doc.id}:`, error)
                results.menus.errors++
            }
        }

        // --- Menus Grupo ---
        const { docs: grupos } = await payload.find({
            collection: 'menus-grupo' as any,
            limit: 100,
            locale: 'es' as any,
            depth: 0,
        })

        results['menus-grupo'] = { total: grupos.length, success: 0, errors: 0 }
        console.log(`[Translate-Menus] Traduciendo ${grupos.length} grupos...`)

        for (const doc of grupos) {
            try {
                for (const locale of TARGET_LOCALES) {
                    const { translatedData, hasTranslations } = await translateDocument({
                        doc,
                        fields: ['nombre', 'descripcion'],
                        targetLang: locale,
                        endpoint,
                        model: modelo,
                        operation: 'update',
                    })

                    if (hasTranslations) {
                        await payload.update({
                            collection: 'menus-grupo' as any,
                            id: doc.id,
                            locale: locale as any,
                            data: translatedData,
                            req: { payload, disableHooks: true } as any,
                        })
                    }
                }
                results['menus-grupo'].success++
                await sleep(500)
            } catch (error) {
                console.error(`[Translate-Menus] Error grupo ${doc.id}:`, error)
                results['menus-grupo'].errors++
            }
        }

        return NextResponse.json({
            message: 'Traducción de menús completada',
            results,
        })
    } catch (error: any) {
        console.error('[Translate-Menus] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
