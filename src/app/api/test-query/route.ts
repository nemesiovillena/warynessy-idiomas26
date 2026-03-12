import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para probar query directa de Payload.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.PAYLOAD_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const log: string[] = [];

    try {
        log.push('🔍 Testing Payload query...');

        // Ejecutar la misma query que Payload hace
        const result = await pool.query(`
            SELECT
                "configuracion_sitio"."id",
                "configuracion_sitio"."title",
                "configuracion_sitio"."logo_id",
                "configuracion_sitio"."description",
                "configuracion_sitio"."contact_phone",
                "configuracion_sitio"."contact_email",
                "configuracion_sitio"."contact_address",
                "configuracion_sitio"."updated_at",
                "configuracion_sitio"."created_at",
                coalesce(json_agg(json_build_array(
                    "configuracion_sitio_openingHours"."_order",
                    "configuracion_sitio_openingHours"."id",
                    "configuracion_sitio_openingHours"."closed",
                    "configuracion_sitio_openingHours__locales"."data"
                ) order by "configuracion_sitio_openingHours"."_order" asc), '[]'::json) as "openingHours"
            FROM "configuracion_sitio"
            LEFT JOIN lateral (
                SELECT
                    "configuracion_sitio_openingHours"."_order",
                    "configuracion_sitio_openingHours"."id",
                    "configuracion_sitio_openingHours"."closed",
                    "configuracion_sitio_openingHours"."_parent_id"
                FROM "configuracion_sitio_opening_hours"
                WHERE "configuracion_sitio_openingHours"."_parent_id" = "configuracion_sitio"."id"
                ORDER BY "configuracion_sitio_openingHours"."_order" ASC
            ) "configuracion_sitio_openingHours" on true
            LEFT JOIN lateral (
                SELECT coalesce(json_agg(json_build_array(
                    "configuracion_sitio_openingHours__locales"."days",
                    "configuracion_sitio_openingHours__locales"."hours",
                    "configuracion_sitio_openingHours__locales"."_locale"
                )), '[]'::json) as "data"
                FROM "configuracion_sitio_opening_hours_locales" "configuracion_sitio_openingHours__locales"
                WHERE "configuracion_sitio_openingHours__locales"."_parent_id" = "configuracion_sitio_openingHours"."id"
            ) "configuracion_sitio_openingHours__locales" on true
            ORDER BY "configuracion_sitio"."created_at" DESC
            LIMIT $1
        `, [1]);

        log.push(`✅ Query successful, rows: ${result.rows.length}`);
        if (result.rows.length > 0) {
            log.push(`Result: ${JSON.stringify(result.rows[0])}`);
        }

        return NextResponse.json({ success: true, log, result: result.rows[0] || null });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        log.push(`Detail: ${error.detail || error.hint || error.code}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
