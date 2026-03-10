import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { NextResponse } from 'next/server'
import pg from 'pg'

export const dynamic = 'force-dynamic'

/**
 * Endpoint para arreglar el schema de configuracion_traduccion en producción.
 * Crea enums y columnas faltantes (proveedor_i_a, modelo_i_a) si no existen.
 * Uso: GET /api/init-config?secret=<PAYLOAD_SECRET>
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbLog: string[] = []
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

    try {
        // 1. Crear enums si no existen
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."enum_configuracion_traduccion_proveedor_i_a"
                    AS ENUM('gemini-api', 'agente-python');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        dbLog.push('Enum proveedor_i_a: ok')

        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."enum_configuracion_traduccion_modelo_i_a"
                    AS ENUM('gemini-2.0-flash', 'gemini-2.5-pro-exp-03-25', 'gemini-1.5-flash', 'gemini-1.5-pro', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat', 'google/gemini-2.0-flash-001');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        dbLog.push('Enum modelo_i_a: ok')

        // 2. Añadir columna proveedor_i_a si no existe
        await pool.query(`
            ALTER TABLE "configuracion_traduccion"
            ADD COLUMN IF NOT EXISTS "proveedor_i_a" "enum_configuracion_traduccion_proveedor_i_a" DEFAULT 'gemini-api';
        `)
        dbLog.push('Column proveedor_i_a: ok')

        // 3. Añadir columna modelo_i_a si no existe
        await pool.query(`
            ALTER TABLE "configuracion_traduccion"
            ADD COLUMN IF NOT EXISTS "modelo_i_a" "enum_configuracion_traduccion_modelo_i_a" DEFAULT 'gemini-2.0-flash';
        `)
        dbLog.push('Column modelo_i_a: ok')

        // 4. Asegurar que hay un registro con los valores correctos
        const countRes = await pool.query(`SELECT COUNT(*) FROM "configuracion_traduccion";`)
        const count = parseInt(countRes.rows[0].count)
        dbLog.push(`Row count: ${count}`)

        if (count === 0) {
            await pool.query(`
                INSERT INTO "configuracion_traduccion" ("proveedor_i_a", "modelo_i_a", "endpoint_agente")
                VALUES ('gemini-api', 'gemini-2.0-flash', 'http://localhost:8000/translate');
            `)
            dbLog.push('Default row inserted.')
        } else {
            await pool.query(`
                UPDATE "configuracion_traduccion"
                SET "proveedor_i_a" = 'gemini-api', "modelo_i_a" = 'gemini-2.0-flash', "updated_at" = now()
                WHERE id = (SELECT id FROM "configuracion_traduccion" ORDER BY id LIMIT 1);
            `)
            dbLog.push('Row updated to gemini-api.')
        }

        // 5. Verificar resultado final
        const finalRow = await pool.query(`SELECT * FROM "configuracion_traduccion" ORDER BY id LIMIT 1;`)
        dbLog.push(`Final row: ${JSON.stringify(finalRow.rows[0])}`)

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
