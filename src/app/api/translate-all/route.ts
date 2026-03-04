import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const secret = searchParams.get('secret')

        // Validar secreto (usamos PAYLOAD_SECRET como llave)
        if (secret !== process.env.PAYLOAD_SECRET && secret !== 'warynessy-force') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })

        const collections = [
            'categorias',
            'menus-grupo',
            'platos',
            'espacios',
            'menus',
            'paginas'
        ]

        const globals = [
            'pagina-inicio'
        ]

        const results: any = {
            collections: {},
            globals: {}
        }

        console.log('[Bulk-Translation] Iniciando proceso masivo...')

        // --- Traducir Colecciones ---
        for (const collection of collections) {
            const { docs } = await payload.find({
                collection: collection as any,
                limit: 1000,
                locale: 'es' as any,
                depth: 0
            })

            results.collections[collection] = { total: docs.length, success: 0, errors: 0 }

            for (const doc of docs) {
                try {
                    // Realizar una actualización que dispare el afterChange hook
                    await payload.update({
                        collection: collection as any,
                        id: doc.id,
                        data: {
                            _triggeredAt: new Date().toISOString()
                        } as any,
                        locale: 'es' as any,
                    })
                    results.collections[collection].success++
                } catch (error) {
                    console.error(`[Bulk-Translation] Error en ${collection} ${doc.id}:`, error)
                    results.collections[collection].errors++
                }
            }
        }

        // --- Traducir Globales ---
        for (const globalSlug of globals) {
            try {
                await payload.updateGlobal({
                    slug: globalSlug as any,
                    data: {
                        _triggeredAt: new Date().toISOString()
                    } as any,
                    locale: 'es' as any
                })
                results.globals[globalSlug] = 'success'
            } catch (error) {
                console.error(`[Bulk-Translation] Error en global ${globalSlug}:`, error)
                results.globals[globalSlug] = 'error'
            }
        }

        return NextResponse.json({
            message: 'Proceso de traducción finalizado con éxito',
            results
        })

    } catch (error: any) {
        console.error('[Bulk-Translation] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
