import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'
import pg from 'pg'

export const dynamic = 'force-dynamic'

/**
 * Endpoint para crear la tabla configuracion_traduccion si no existe
 * y luego inicializar el global via Payload.
 * Uso: GET /api/init-config?secret=<PAYLOAD_SECRET>
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbLog: string[] = []

    // Paso 1: Crear la tabla directamente con pg si no existe
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    try {
        const tableCheck = await pool.query(`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'configuracion_traduccion');
        `)
        const tableExists = tableCheck.rows[0].exists
        dbLog.push(`Table exists: ${tableExists}`)

        if (!tableExists) {
            await pool.query(`
                CREATE TABLE "configuracion_traduccion" (
                    "id" serial PRIMARY KEY,
                    "proveedor_i_a" varchar DEFAULT 'gemini-api',
                    "modelo_i_a" varchar DEFAULT 'gemini-2.0-flash',
                    "endpoint_agente" varchar DEFAULT 'http://localhost:8000/translate',
                    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
                    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
                );
            `)
            dbLog.push('Table created.')
        }

        // Asegurar que hay al menos un registro
        const countRes = await pool.query(`SELECT COUNT(*) FROM "configuracion_traduccion";`)
        const count = parseInt(countRes.rows[0].count)
        dbLog.push(`Row count: ${count}`)

        // Leer las columnas reales de la tabla
        const colsRes = await pool.query(`
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = 'configuracion_traduccion' ORDER BY ordinal_position;
        `)
        dbLog.push(`Columns: ${JSON.stringify(colsRes.rows)}`)

        // Leer el registro existente
        const finalRow = await pool.query(`SELECT * FROM "configuracion_traduccion" ORDER BY id LIMIT 1;`)
        dbLog.push(`Current row: ${JSON.stringify(finalRow.rows[0])}`)
    } catch (e: any) {
        dbLog.push(`DB error: ${e.message}`)
    } finally {
        await pool.end()
    }

    // Paso 2: Verificar via Payload
    let payloadRead: any = null
    let payloadError: string | null = null
    try {
        const payload = await getPayload({ config })
        payloadRead = await payload.findGlobal({ slug: 'configuracion-traduccion' as any })
    } catch (e: any) {
        payloadError = e.message
    }

    return NextResponse.json({ dbLog, payloadRead, payloadError })
}
