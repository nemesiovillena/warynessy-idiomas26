import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export const dynamic = 'force-dynamic';

/**
 * Endpoint para verificar tablas de relación.
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
        // Verificar cada tabla de relación
        const relTables = [
            'configuracion_sitio_opening_hours',
            'configuracion_sitio_footer_logos',
            'configuracion_sitio_opening_hours_locales',
            'configuracion_sitio_locales',
            'pagina_inicio_galeria_inicio',
            'pagina_inicio_galeria_inicio_locales',
            'pagina_inicio_galeria_regalo',
            'pagina_inicio_locales',
            'pagina_inicio_rels',
        ];

        for (const tableName of relTables) {
            const count = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
            log.push(`${tableName}: ${count.rows[0].count} rows`);
        }

        // Verificar estructura de configuracion_sitio_opening_hours
        const openingHoursColumns = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'configuracion_sitio_opening_hours'
            ORDER BY ordinal_position
        `);
        log.push(`\nconfiguracion_sitio_opening_hours columns:`);
        openingHoursColumns.rows.forEach((c: any) => log.push(`  - ${c.column_name}: ${c.data_type}`));

        return NextResponse.json({ success: true, log });
    } catch (error: any) {
        log.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
