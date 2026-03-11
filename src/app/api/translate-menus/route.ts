import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'
import { translatingIds } from '../../../payload/utils/translation-utils'

export const dynamic = 'force-dynamic'
// Aumentar el timeout para este endpoint
export const maxDuration = 300

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const secret = searchParams.get('secret')

        if (secret !== process.env.PAYLOAD_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

        const results: Record<string, any> = {}

        // Traducir menus
        const { docs: menus } = await payload.find({
            collection: 'menus',
            limit: 1000,
            locale: 'es' as any,
            depth: 0,
        })

        results.menus = { total: menus.length, success: 0, errors: 0 }
        console.log(`[Translate-Menus] Traduciendo ${menus.length} menús...`)

        for (const doc of menus) {
            try {
                while (translatingIds.has(doc.id)) await sleep(500)
                await payload.update({
                    collection: 'menus',
                    id: doc.id,
                    data: { _triggeredAt: new Date().toISOString() } as any,
                    locale: 'es' as any,
                })
                results.menus.success++
                console.log(`[Translate-Menus] Menú ${doc.id} disparado`)
                await sleep(2000) // 2s entre documentos para no saturar el agente
            } catch (error) {
                console.error(`[Translate-Menus] Error menú ${doc.id}:`, error)
                results.menus.errors++
            }
        }

        // Traducir menus-grupo
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
                while (translatingIds.has(doc.id)) await sleep(500)
                await payload.update({
                    collection: 'menus-grupo' as any,
                    id: doc.id,
                    data: { _triggeredAt: new Date().toISOString() } as any,
                    locale: 'es' as any,
                })
                results['menus-grupo'].success++
                await sleep(2000)
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
