import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint temporal para diagnosticar y arreglar el global configuracion-traduccion.
 * Uso: GET /api/init-config?secret=<PAYLOAD_SECRET>
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await getPayload({ config })

        // Intentar leer el global
        let current: any = null
        let readError: string | null = null
        try {
            current = await payload.findGlobal({ slug: 'configuracion-traduccion' as any })
        } catch (e: any) {
            readError = e.message
        }

        // Intentar actualizar/crear con valores correctos
        let updateResult: any = null
        let updateError: string | null = null
        try {
            updateResult = await payload.updateGlobal({
                slug: 'configuracion-traduccion' as any,
                data: {
                    proveedorIA: 'gemini-api',
                    modeloIA: 'gemini-2.0-flash',
                    endpointAgente: 'http://localhost:8000/translate',
                } as any,
            })
        } catch (e: any) {
            updateError = e.message
        }

        return NextResponse.json({
            readBefore: current,
            readError,
            updateResult,
            updateError,
        })
    } catch (e: any) {
        return NextResponse.json({ fatalError: e.message, stack: e.stack }, { status: 500 })
    }
}
